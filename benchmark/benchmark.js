
const createTorrentPack = require("create-torrent")
const { createTorrent } = require("../dist")
const mockfs = require("mock-fs")
const { Writable, PassThrough } = require("stream")
const consumers = require("stream/consumers")
const fs = require("fs")
const Benchmarkify = require("benchmarkify")
const Torrent = require("node-torrent-stream")

const benchmark = new Benchmarkify("Comparison", { description: "Compares create-torrent to torrent-create-stream and torrent-create-stream in parallel", chartImage: true }).printHeader();



benchmark.createSuite("10MB File")
.setup(() => {
    mockfs({
        'file': Buffer.alloc(1024 * 1024 * 10)
    });
})
.add("create-torrent", async (done) => {
    createTorrentPack("./file", (err, torrent) => {
        if (err) throw err
        done()
    })
})
.ref("torrent-create-stream", async (done) => {
    let stream = new PassThrough()
    let data = consumers.buffer(stream)
    createTorrent({
        files: {
            length: fs.statSync("file").size,
            path: "file",
            getStream: (startAt, endAt) => fs.createReadStream("file", { start: startAt, end: endAt })
        },
        name: "Test Torrent",
    }, stream)
    await data
    done()
}).ref("torrent-stream", async (done) => {
    let stream = new PassThrough()
    let data = consumers.buffer(stream)
    let torrent = new Torrent({
        announce: "http://localhost:8080/announce",
        name: "Test Torrent",
    })
    fs.createReadStream("file").pipe(torrent)
    torrent.pipe(stream)
    await data
    done()
})

benchmark.run();

benchmark.createSuite("2GB File")
.setup(() => {
    mockfs({
        'file': Buffer.alloc(1024 * 1024 * 1024 * 2)
    });
})
.add("create-torrent", async (done) => {
    createTorrentPack("./file", (err, torrent) => {
        if (err) throw err
        done()
    })
})
.ref("torrent-create-stream", async (done) => {
    let stream = new PassThrough()
    let data = consumers.buffer(stream)
    createTorrent({
        files: {
            length: fs.statSync("file").size,
            path: "file",
            getStream: (startAt, endAt) => fs.createReadStream("file", { start: startAt, end: endAt })
        },
        name: "Test Torrent",
    }, stream)
    await data
    done()
}).ref("torrent-stream", async (done) => {
    let stream = new PassThrough()
    let data = consumers.buffer(stream)
    let torrent = new Torrent({
        announce: "http://localhost:8080/announce",
        name: "Test Torrent",
    })
    fs.createReadStream("file").pipe(torrent)
    torrent.pipe(stream)
    await data
    done()
})

benchmark.run();


// const start3 = Date.now()
// createTorrent({
//     files: {
//         length: 1024 * 1024 * 1024 * 10,
//         path: "large_file",
//         getStream: (startAt, endAt) => fs.createReadStream("large_file", { start: startAt, end: endAt })
//     },
//     parallelReads: 8,
//     name: "Test Torrent",
// }, new Writable({
//     write: (a,b,cb) => cb()
// })).then(() => {
//     console.log("create-torrent-js (parallel) took", Date.now() - start3, "ms")

//     const start = Date.now()
//     createTorrentPack("./large_file", (err, torrent) => {
//         if (err) throw err
//         console.log("create-torrent took", Date.now() - start, "ms")
    
//         const start2 = Date.now()
//         createTorrent({
//             files: {
//                 length: 1024 * 1024 * 1024 * 10,
//                 path: "large_file",
//                 getStream: (startAt, endAt) => fs.createReadStream("large_file", { start: startAt, end: endAt })
//             },
//             name: "Test Torrent",
//         }, new Writable({
//             write: (a,b,cb) => cb()
//         })).then(() => {
//             console.log("create-torrent-js took", Date.now() - start2, "ms")
//         })
//     })
// })