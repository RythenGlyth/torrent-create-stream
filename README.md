# torrent-create-stream
[![npm](https://img.shields.io/npm/v/torrent-create-stream.svg)](https://npmjs.org/package/torrent-create-stream)

This package is an alternative package to create torrent files. It has two main advantages over the [torrent-create](https://www.npmjs.com/package/torrent-create) package:

- This package allows to create torrent files from dynamically generated streams. This is useful if you want to create a torrent file from a stream that is not a file on the disk but rather a large file that is generated in memory or from a database which you don't want to load completely into memory.

- This package writes to an output stream instead of a file.

## Install

```sh
npm install torrent-create-stream
```

## Usage

```js
import createTorrent from 'torrent-create-stream'
import fs from 'fs'

await createTorrent({
    files: [
        {
            name: "file_from_memory.txt",
            length: 100,
            getStream: (startAt, endAt) => {
                return new Readable({
                    read() {
                        for (let i = startAt; i < endAt; i++) {
                            this.push("a")
                        }
                        this.push(null)
                    }
                })
            }
        },
        {
            name: "file_from_os.txt",
            length: fs.statSync("./file_from_os.txt").size,
            getStream: (startAt, endAt) => {
                return fs.createReadStream("./file_from_os.txt", {
                    start: startAt,
                    end: endAt
                })
            }
        }
    ],
    announce: [
        ['udp://tracker.leechers-paradise.org:6969'],
        ['udp://tracker.coppersurfer.tk:6969'],
        ['udp://tracker.opentrackr.org:1337'],
        ['udp://explodie.org:6969'],
        ['udp://tracker.empire-js.us:1337'],
        ['wss://tracker.btorrent.xyz'],
        ['wss://tracker.openwebtorrent.com'],
        ['wss://tracker.webtorrent.dev']
    ],
    isPrivate: true,
    name: "Test Torrent"
}, fs.createWriteStream("./test.torrent"))
```

## Contributing

Feel free to contribute to this project. Fork and make a Pull Request, or create an Issue if you see any problem.