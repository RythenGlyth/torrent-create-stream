# torrent-create-stream
[npm-badge]: https://img.shields.io/npm/v/torrent-create-stream.svg
[npm-url]: https://npmjs.org/package/torrent-create-stream



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
            getStream: () => {
                return new Readable({
                    read() {
                        for (let i = 0; i < 100; i++) {
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
            getStream: () => {
                return fs.createReadStream("./file_from_os.txt")
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