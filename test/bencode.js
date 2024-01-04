const { describe, it } = require('mocha')
const { bencodeStreamable } = require("../dist")
const { Writable } = require('stream')
const assert = require('assert')
const { StreamableBuffer } = require('./utility')

describe('bencodeStreamable', () => {
    it('should encode strings', () => {
        let stream = new StreamableBuffer()
        bencodeStreamable.encodeString("spam", stream)
        assert.equal(stream.toString(), "4:spam")
    })
    it('should encode integers', () => {
        let stream = new StreamableBuffer()
        bencodeStreamable.encodeInt(123, stream)
        assert.equal(stream.toString(), "i123e")
    })
    it('should encode negative integers', () => {
        let stream = new StreamableBuffer()
        bencodeStreamable.encodeInt(-3, stream)
        assert.equal(stream.toString(), "i-3e")
    })
    it('should encode lists of numbers', async () => {
        let stream = new StreamableBuffer()
        let list = [1,2,3]
        await bencodeStreamable.encodeList(async (to) => {
            list.forEach((n) => bencodeStreamable.encodeInt(n, to) )
        }, stream)
        assert.equal(stream.toString(), "li1ei2ei3ee")
    })
    it('should encode lists of strings', async () => {
        let stream = new StreamableBuffer()
        let list = ["spam", "eggs"]
        await bencodeStreamable.encodeList(async (to) => {
            list.forEach((n) => bencodeStreamable.encodeString(n, to) )
        }, stream)
        assert.equal(stream.toString(), "l4:spam4:eggse")
    })
    it('should encode dicts (1)', async () => {
        let stream = new StreamableBuffer()
        await bencodeStreamable.encodeDict(async (to) => {
            bencodeStreamable.encodeString("cow", to)
            bencodeStreamable.encodeString("moo", to)
            bencodeStreamable.encodeString("spam", to)
            bencodeStreamable.encodeString("eggs", to)
        }, stream)
        assert.equal(stream.toString(), "d3:cow3:moo4:spam4:eggse")
    })
    it('should encode dicts (2)', async () => {
        let stream = new StreamableBuffer()
        await bencodeStreamable.encodeDict(async (to) => {
            bencodeStreamable.encodeString("spam", to)
            await bencodeStreamable.encodeList(async (to) => {
                bencodeStreamable.encodeString("a", to)
                bencodeStreamable.encodeString("b", to)
            }, to)
        }, stream)
        assert.equal(stream.toString(), "d4:spaml1:a1:bee")
    })
    it("should encode complex object", async () => {
        let stream = new StreamableBuffer()
        await bencodeStreamable.encodeObj({
            "cow": "moo",
            "buff": Buffer.from("spam"),
            "dict": {
                "spam": "eggs"
            },
            "spam": ["a", "b"],
            "int": 123
        }, stream)
        assert.equal(stream.toString(), "d3:cow3:moo4:buff4:spam4:dictd4:spam4:eggse4:spaml1:a1:be3:inti123ee")
    })
})