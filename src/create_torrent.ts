import crypto from 'crypto'
import optimumPieceLength from 'piece-length'
import { PassThrough, Readable, Writable } from "stream"
import { bencodeStreamable as ben } from "./streamable_bencode"


type File = {
    path: string,
    length: number,
    getStream: () => Readable
}

export async function createTorrent({
        files,
        name,
        announce,
        pieceLength,
        meta
    }: {
        files: File[] | File,
        name: string,
        announce?: string | string[] | string[][],
        private?: boolean,
        pieceLength?: number,
        meta?: {
            "comment"?: string,
            "created by"?: string,
            "creation date"?: number,
            "encoding"?: string,
            "publisher"?: string,
            "publisher-url"?: string,
            [key: string]: unknown
        }
    },
    to: Writable
) {
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

            if(meta?.private) {
                ben.encodeString('private', to)
                ben.encodeInt(1, to)
            }

            if (Array.isArray(files)) {
                ben.encodeString('files', to)
                await ben.encodeList(async to => {
                    for (const file of files) {
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
            ben.encodeString('piece length', to)
            ben.encodeInt(pieceLength!, to)
            
            const piecesStream = new PassThrough()
            ben.encodeString('pieces', to)
            ben.encodeStream(piecesStream, Math.ceil(alllength / pieceLength!) * 20, to)
    
            const getStreams = Array.isArray(files) ? files.map(file => file.getStream) : [files.getStream]
            
            let piece = Buffer.alloc(0)
            for (const getStream of getStreams) {
                const stream = getStream()
                stream.on('data', chunk => {
                    let offset = 0
                    while (offset < chunk.length) {
                        const remaining = pieceLength! - piece.length
                        if (chunk.length - offset < remaining) {
                            piece = Buffer.concat([piece, chunk.slice(offset)])
                            offset += chunk.length - offset
                        } else {
                            piece = Buffer.concat([piece, chunk.slice(offset, offset + remaining)])
                            offset += remaining
                            piecesStream.write(crypto.createHash('sha1').update(piece).digest())
                            piece = Buffer.alloc(0)
                        }
                    }
                })
                await new Promise((resolve, reject) => {
                    stream.on('end', resolve)
                    stream.on('error', reject)
                })
            }
            if (piece.length) {
                piecesStream.write(crypto.createHash('sha1').update(piece).digest())
            }
            piecesStream.end()
        }, to)
    }, to)
    to.end()
}