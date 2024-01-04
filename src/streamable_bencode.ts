import { Readable, Writable } from "stream"


function encodeInt(int: number, to: Writable) {
    to.write(Buffer.from(`i${int}e`))
}

function encodeString(str: string, to: Writable) {
    to.write(Buffer.from(`${str.length}:${str}`))
}

function encodeBuffer(buf: Buffer, to: Writable) {
    to.write(Buffer.from(`${buf.length}:`))
    to.write(buf)
}
async function encodeStream(from: Readable, length: number, to: Writable) {
    to.write(Buffer.from(`${length}:`))
    await new Promise<void>((resolve, reject) => {
        from.on('data', chunk => {
            to.write(chunk)
        })
        from.on('end', () => {
            resolve()
        })
        from.on('error', err => {
            reject(err)
        })
    })
}

/**
 * 
 * @param add should add the items to the stream
 * @param to the stream to add the list to
 */
async function encodeList(add: (to: Writable) => Promise<void>, to: Writable) {
    to.write(Buffer.from('l'))
    await add(to)
    to.write(Buffer.from('e'))
}

/**
 * 
 * @param add should add the key and value pairs to the stream
 * @param to the stream to add the dictionary to
 */
async function encodeDict(add: (to: Writable) => Promise<void>, to: Writable) {
    to.write(Buffer.from('d'))
    await add(to)
    to.write(Buffer.from('e'))
}

async function encodeObj(obj: unknown, to: Writable) {
    if (typeof obj === 'number') {
        encodeInt(obj, to)
    } else if (typeof obj === 'string') {
        encodeString(obj, to)
    } else if (Buffer.isBuffer(obj)) {
        encodeBuffer(obj, to)
    } else if (Array.isArray(obj)) {
        await encodeList(async to => {
            for (const item of obj) {
                await encodeObj(item, to)
            }
        }, to)
    } else if (typeof obj === 'object') {
        await encodeDict(async to => {
            for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
                encodeString(key, to)
                await encodeObj(value, to)
            }
        }, to)
    } else {
        throw new Error(`Unknown type ${typeof obj}`)
    }
}

export const bencodeStreamable = {
    encodeInt,
    encodeString,
    encodeBuffer,
    encodeStream,
    encodeList,
    encodeDict,
    encodeObj
}