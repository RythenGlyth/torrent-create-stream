const { describe, it } = require('mocha')
const { createTorrent } = require("../dist")
const { Writable } = require('stream')
const assert = require('assert')
const mockfs = require('mock-fs')
const fs = require('fs')
const { walk, StreamableBuffer } = require('./utility')
const path = require('path')
const createTorrentPack = require("create-torrent")

describe('createTorrent', () => {
    it('should create a torrent', async () => {
        mockfs({
            'test': {
                'test.txt': 'Testfile 1',
                'test2.txt': 'Testfile 2',
                'subdir': {
                    'test.txt': 'Testfile 1 another one'
                }
            },
            'test2': {
                'test2.txt': 'Testfile 2 another one'
            },
        })
        let stream = new StreamableBuffer()
        
        await createTorrent({
            files: walk('test').map((entry) => ({
                length: entry[Object.getOwnPropertySymbols(entry).find((s) => s.description == "stats")].size,
                path: entry.name,
                getStream: (startAt, endAt) => fs.createReadStream("test/" + entry.name, { start: startAt, end: endAt })
            })),
            announce: "http://localhost:8080/announce",
            isPrivate: true,
            name: "Test Torrent",
            onPiecesProgress: (currFile, fileCount, bytesRead, totalBytes, currPiece, pieceCount) => {
                console.log("progress Normal:", currFile, fileCount, bytesRead, totalBytes, currPiece, pieceCount)
            }
        }, stream)
        mockfs.restore()
        fs.writeFileSync("test_out/test.torrent", stream.toBuffer())

    })
    it('should create a torrent which is equal to create-torrent torrent file', async () => {
        // mockfs({
        //     'test': {
        //         'test.txt': 'Testfile 1',
        //         'test2.txt': 'Testfile 2',
        //         'subdir': {
        //             'test.txt': 'Testfile 1 another one'
        //         }
        //     },
        //     'test2': {
        //         'test2.txt': 'Testfile 2 another one'
        //     },
        // })
        let stream = new StreamableBuffer()
        
        const path = "./test"
        await createTorrent({
            files: walk(path).map((entry) => ({
                length: fs.statSync(path + "/" + entry.name).size,
                path: entry.name,
                getStream: (startAt, endAt) => fs.createReadStream(path + "/" + entry.name, { start: startAt, end: endAt })
            })),
            announce: "http://localhost:8080/announce",
            isPrivate: true,
            name: "Test Torrent"
        }, stream)
        createTorrentPack(path, {
            announce: "http://localhost:8080/announce",
            private: true,
            name: "Test Torrent",
        }, (err, torrent) => {
            if (err) throw err
            mockfs.restore()
            fs.writeFileSync("test_out/test_pack.torrent", torrent)
            fs.writeFileSync("test_out/test_stream.torrent", stream.toBuffer())
        })
    })

    it('should create a torrent async', async () => {
        mockfs({
            'test': {
                'test.txt': 'Testfile 1',
                'test2.txt': 'Testfile 2',
                'subdir': {
                    'test.txt': 'Testfile 1 another one'
                }
            },
            'test2': {
                'test2.txt': 'Testfile 2 another one'
            },
        })
        let stream = new StreamableBuffer()
        
        await createTorrent({
            files: walk('test').map((entry) => ({
                length: entry[Object.getOwnPropertySymbols(entry).find((s) => s.description == "stats")].size,
                path: entry.name,
                getStream: (startAt, endAt) => fs.createReadStream("test/" + entry.name, { start: startAt, end: endAt })
            })),
            announce: "http://localhost:8080/announce",
            isPrivate: true,
            name: "Test Torrent",
            onPiecesProgress: (currFile, fileCount, bytesRead, totalBytes, currPiece, pieceCount) => {
                console.log("progress async:", currFile, fileCount, bytesRead, totalBytes, currPiece, pieceCount)
            },
            parallelReads: 5
        }, stream)
        mockfs.restore()
        fs.writeFileSync("test_out/test_async.torrent", stream.toBuffer())

    })
})
