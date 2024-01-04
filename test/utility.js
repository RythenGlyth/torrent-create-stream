const { Writable } = require("stream")
const fs = require("fs")


module.exports.StreamableBuffer = class StreamableBuffer extends Writable {
    constructor() {
        super()
        this.stream_data = []
    }
    _write(chunk, encoding, callback) {
        this.stream_data.push(chunk)
        callback()
    }
    toString() {
        return Buffer.concat(this.stream_data).toString()
    }
    toBuffer() {
        return Buffer.concat(this.stream_data)
    }
}

/**
 * 
 * @param {string} dir 
 * @returns {fs.Dirent[]}
 */
module.exports.walk = function walk(dir) {
    let files = []
    fs.readdirSync(dir, {
        withFileTypes: true
    }).forEach((entry) => {
        if (entry.isDirectory()) {
            walk(dir + "/" + entry.name).forEach((file) => {
                file.name = entry.name + "/" + file.name
                files.push(file)
            })
        } else {
            files.push(entry)
        }
    })
    return files
}