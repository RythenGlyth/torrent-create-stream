import crypto from 'crypto'
import optimumPieceLength from 'piece-length'
import { PassThrough, Readable, Writable } from "stream"
import { bencodeStreamable as ben } from "./streamable_bencode"


type File = {
    path: string,
    length: number,
    getStream: (startAt: number, endAt: number) => Promise<Readable>
}

export async function createTorrent({
        files,
        name,
        announce,
        isPrivate,
        pieceLength,
        meta,
        info,
        onPiecesProgress,
        parallelReads
    }: {
        files: File[] | File,
        name: string,
        announce?: string | string[] | string[][],
        isPrivate?: boolean,
        pieceLength?: number,
        meta?: {
            "comment"?: string,
            "created by"?: string,
            "creation date"?: number,
            "encoding"?: string,
            "publisher"?: string,
            "publisher-url"?: string,
            [key: string]: unknown
        },
        info?: {
            "source"?: string,
        },
        onPiecesProgress?: (currFile: number, fileCount: number, bytesRead: number, totalBytes: number, currPiece: number, pieceCount: number) => void,
        parallelReads?: number
    },
    to: Writable
) {//TODO: progress
    if(!name) throw new Error('name is required')
    if(!files) throw new Error('files is required')
    if(!to) throw new Error('to is required')
    await ben.encodeDict(async to => {
        if (announce) {
            if (typeof announce === 'string') {
                ben.encodeString('announce', to)
                ben.encodeString(announce, to)
                ben.encodeString('announce-list', to)
                await ben.encodeObj([[announce]], to)
            } else {
                ben.encodeString('announce', to)
                ben.encodeString(typeof announce[0] == "string" ? announce[0] : announce[0][0], to)
                ben.encodeString('announce-list', to)
                await ben.encodeList(async to => {
                    for (const tier of announce) {
                        await ben.encodeObj(Array.isArray(tier) ? tier : [tier], to)
                    }
                }, to)
            }
        }
        if (meta) {
            for (const [key, value] of Object.entries(meta)) {
                ben.encodeString(key, to)
                await ben.encodeObj(value, to)
            }
        }
        ben.encodeString('info', to)
        await ben.encodeDict(async to => {
            ben.encodeString('name', to)
            ben.encodeString(name, to)

            if(isPrivate) {
                ben.encodeString('private', to)
                ben.encodeInt(1, to)
            }

            if (Array.isArray(files)) {
                ben.encodeString('files', to)
                await ben.encodeList(async to => {
                    for (const file of files as File[]) {
                        await ben.encodeDict(async to => {
                            ben.encodeString('length', to)
                            ben.encodeInt(file.length, to)

                            ben.encodeString('path', to)
                            await ben.encodeList(async to => {
                                file.path.split('/').forEach(part => ben.encodeString(part, to))
                            }, to)
                        }, to)
                    }
                }, to)
            } else {
                ben.encodeString('length', to)
                ben.encodeInt((files as File).length, to)
            }


            const alllength = Array.isArray(files) ? files.reduce((acc, file) => acc + file.length, 0) : files.length
            if(!pieceLength) pieceLength = optimumPieceLength(alllength)
            const pieceCount = Math.ceil(alllength / pieceLength!)
            let byteTracker = 0
            ben.encodeString('piece length', to)
            ben.encodeInt(pieceLength!, to)
            
            const piecesStream = new PassThrough()
            ben.encodeString('pieces', to)
            ben.encodeStream(piecesStream, pieceCount * 20, to)
    
            files = (Array.isArray(files) ? files : [files]) as File[]
            
            if(!parallelReads) {
                //let piece = Buffer.alloc(0)
                let hash = crypto.createHash("sha1")
                let currLength = 0
                for (const i in files) {
                    const stream = await files[i].getStream(0, files[i].length)
                    stream.on('data', chunk => {
                        byteTracker += chunk.length
                        if (onPiecesProgress) onPiecesProgress(Number(i), files.length, byteTracker, alllength, Math.floor((byteTracker-1) / pieceLength!), pieceCount)
                        let offset = 0
                        while (offset < chunk.length) {
                            //const remaining = pieceLength! - piece.length
                            const remaining = pieceLength! - currLength
                            if (chunk.length - offset < remaining) {
                                //piece = Buffer.concat([piece, chunk.slice(offset)])
                                hash.update(chunk.slice(offset))
                                currLength += chunk.length - offset
                                offset += chunk.length - offset
                            } else {
                                //piece = Buffer.concat([piece, chunk.slice(offset, offset + remaining)])
                                hash.update(chunk.slice(offset, offset + remaining))
                                offset += remaining
                                //piecesStream.write(crypto.createHash("sha1").update(piece).digest())
                                //piece = Buffer.alloc(0)
                                piecesStream.write(hash.digest())
                                hash = crypto.createHash("sha1")
                                currLength = 0
                            }
                        }
                    })
                    await new Promise((resolve, reject) => {
                        stream.on('end', resolve)
                        stream.on('error', reject)
                    })
                }
                //if (piece.length) {
                if (currLength) {
                    //piecesStream.write(crypto.createHash("sha1").update(piece).digest())
                    piecesStream.write(hash.digest())
                    if (onPiecesProgress) onPiecesProgress(files.length-1, files.length, alllength, alllength, Math.floor((alllength-1) / pieceLength!), pieceCount)
                }
            } else {
                let currFile = 0
                let currFileByte = 0
                const pieces: {
                    from: {
                        file: number,
                        start: number
                    },
                    to: {
                        file: number,
                        end: number
                    }
                }[] = Array(pieceCount).fill(0).map(() => {
                    while(currFileByte > (files as File[])[currFile].length) {
                        currFile++
                        currFileByte = 0
                    }
                    const from = {
                        file: currFile,
                        start: currFileByte
                    }
                    currFileByte += pieceLength!
                    while(currFileByte > (files as File[])[currFile].length) {
                        currFileByte -= (files as File[])[currFile].length
                        if(currFile == (files as File[]).length-1) {
                            currFileByte = (files as File[])[currFile].length
                            break
                        }
                        currFile++
                    }
                    const to = {
                        file: currFile,
                        end: currFileByte
                    }
                    return {
                        from,
                        to
                    }
                })
                const taskFinishPromises: {resolve: (buf: ArrayBuffer) => void, promise: Promise<ArrayBuffer>}[] = Array(pieceCount).fill(0).map(() => {
                    let resolve: (_: ArrayBuffer) => void
                    const x = {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        resolve: (_: ArrayBuffer) => {},
                        promise: new Promise<ArrayBuffer>(res => {
                            resolve = ((buf) => {res(buf)})
                        })
                    }
                    x.resolve = resolve!
                    return x
                })
                let currPiece = 0
                const collectPiece = async (pieceNum: number) => {
                    //let piece = Buffer.alloc(0)
                    const hash = crypto.createHash("sha1")
                    //let currLength = 0
                    let currFile = pieces[pieceNum].from.file
                    let currFileByte = pieces[pieceNum].from.start
                    while(currFile <= pieces[pieceNum].to.file) {
                        const stream = await (files as File[])[currFile].getStream(currFileByte, currFile == pieces[pieceNum].to.file ? pieces[pieceNum].to.end : (files as File[])[currFile].length)
                        stream.on('data', chunk => {
                            byteTracker += chunk.length
                            if (onPiecesProgress) onPiecesProgress(pieces[currPiece].to.file, files.length, byteTracker, alllength, currPiece, pieceCount)

                            //piece = Buffer.concat([piece, chunk])
                            hash.update(chunk)
                            //currLength += chunk.length
                        })
                        await new Promise((resolve, reject) => {
                            stream.on('end', resolve)
                            stream.on('error', reject)
                        })
                        currFileByte = 0
                        currFile++
                    }
                    //taskFinishPromises[pieceNum].resolve(crypto.createHash("sha1").update(piece).digest())
                    taskFinishPromises[pieceNum].resolve(hash.digest())
                }
                (async () => {
                    //always run parallelReads x collectPiece
                    let lastPiece = 0
                    let running = 0
                    function fillRunning() {
                        while(running < parallelReads! && lastPiece < pieces.length) {
                            collectPiece(lastPiece).then(() => {
                                running--
                                fillRunning()
                            }).catch(err => {
                                throw err
                            })
                            lastPiece++
                            running++
                        }
                    }
                    fillRunning()
                })()
                for(currPiece = 0; currPiece < taskFinishPromises.length; currPiece++) {
                    const buff = await taskFinishPromises[currPiece].promise
                    piecesStream.write(buff)
                    if (onPiecesProgress) onPiecesProgress(pieces[currPiece].to.file, files.length, byteTracker, alllength, currPiece, pieceCount)
                }
            }
            piecesStream.end()

            if (info) {
                for (const [key, value] of Object.entries(info)) {
                    ben.encodeString(key, to)
                    await ben.encodeObj(value, to)
                }
            }
        }, to)
    }, to)
    to.end()
}