import assert from 'node:assert/strict';

export function jpegHeaders(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'Not a JPEG');
  const segments = [];
  for (let offset = 2; offset < bytes.length - 4;) {
    assert.equal(bytes[offset], 0xff, `Invalid marker at ${offset}`);
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) return segments;
    const size = bytes.readUInt16BE(offset + 2) + 2;
    assert(size >= 4 && offset + size <= bytes.length, 'Invalid JPEG segment length');
    segments.push({ marker, offset, data: bytes.subarray(offset, offset + size), payload: bytes.subarray(offset + 4, offset + size) });
    offset += size;
  }
  throw new Error('JPEG has no scan');
}

export function mpfIndex(segment) {
  assert.equal(segment.subarray(4, 8).toString('ascii'), 'MPF\0');
  const tiff = 8;
  const order = segment.subarray(tiff, tiff + 2).toString('ascii');
  assert(['MM', 'II'].includes(order));
  const little = order === 'II';
  const u16 = offset => little ? segment.readUInt16LE(offset) : segment.readUInt16BE(offset);
  const u32 = offset => little ? segment.readUInt32LE(offset) : segment.readUInt32BE(offset);
  const put = (offset, value) => little ? segment.writeUInt32LE(value, offset) : segment.writeUInt32BE(value, offset);
  assert.equal(u16(tiff + 2), 42);
  const ifd = tiff + u32(tiff + 4);
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const item = ifd + 2 + i * 12;
    if (u16(item) !== 0xb002) continue;
    const length = u32(item + 4);
    assert.equal(length, 32, 'Expected exactly two MP images');
    const offset = tiff + u32(item + 8);
    assert(offset + length <= segment.length);
    return { offset, u32, put, tiff };
  }
  throw new Error('Missing MPEntry');
}

export function splitGainmap(bytes) {
  const mpf = jpegHeaders(bytes).find(segment => segment.marker === 0xe2 && segment.payload.subarray(0, 4).toString('ascii') === 'MPF\0');
  assert(mpf, 'Missing multi-picture gain map index');
  const index = mpfIndex(mpf.data);
  const baseLength = index.u32(index.offset + 4);
  const gainLength = index.u32(index.offset + 20);
  const gainStart = mpf.offset + index.tiff + index.u32(index.offset + 24);
  assert.equal(gainStart, baseLength, 'Unexpected gap before gain map');
  assert.equal(gainStart + gainLength, bytes.length, 'Unexpected trailer');
  assert.equal(bytes.readUInt16BE(baseLength - 2), 0xffd9);
  assert.equal(bytes.readUInt16BE(gainStart), 0xffd8);
  assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9);
  return { base: bytes.subarray(0, baseLength), gain: bytes.subarray(gainStart), mpf: Buffer.from(mpf.data) };
}

const ISO = Buffer.from('urn:iso:std:iso:ts:21496:-1\0');
const XMP = Buffer.from('http://ns.adobe.com/xap/1.0/\0');

function segment(marker, payload) {
  const header = Buffer.from([0xff, marker, 0, 0]);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}

function prepend(jpeg, value) {
  return Buffer.concat([jpeg.subarray(0, 2), value, jpeg.subarray(2)]);
}

export function compatibleGlyphGainmap(bytes) {
  const original = splitGainmap(bytes);
  const oldIndex = jpegHeaders(original.base).find(item => item.marker === 0xe2 && item.payload.subarray(0, 4).toString('ascii') === 'MPF\0');
  const base = Buffer.concat([original.base.subarray(0, oldIndex.offset), original.base.subarray(oldIndex.offset + oldIndex.data.length)]);
  const oldMetadata = jpegHeaders(original.gain).find(item => item.marker === 0xe2 && item.payload.subarray(0, ISO.length).equals(ISO));
  assert(oldMetadata);
  // ISO 21496-1 version 0 reserves the common-denominator bit. Some codec builds
  // write it anyway, which passes their own validator but is ignored by ImageIO.
  // Use independent fractions and explicit RGB channels, like the reference scans.
  const fractions = [0, 1, 2, 1, ...Array.from({ length: 3 }, () => [0, 1, 2, 1, 1, 1, 0, 1, 0, 1]).flat()];
  const values = Buffer.alloc(fractions.length * 4);
  fractions.forEach((value, index) => values.writeInt32BE(value, index * 4));
  const metadata = Buffer.concat([ISO, Buffer.alloc(4), Buffer.from([0xc0]), values]);
  let gain = Buffer.concat([original.gain.subarray(0, oldMetadata.offset), segment(0xe2, metadata), original.gain.subarray(oldMetadata.offset + oldMetadata.data.length)]);
  const packet = body => segment(0xe1, Buffer.concat([XMP, Buffer.from(`<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">${body}</rdf:RDF></x:xmpmeta>`)]));
  gain = prepend(gain, packet('<rdf:Description rdf:about="" xmlns:hdrgm="http://ns.adobe.com/hdr-gain-map/1.0/" hdrgm:Version="1.0" hdrgm:BaseRenditionIsHDR="False" hdrgm:GainMapMin="0" hdrgm:GainMapMax="2" hdrgm:Gamma="1" hdrgm:OffsetSDR="0" hdrgm:OffsetHDR="0" hdrgm:HDRCapacityMin="0" hdrgm:HDRCapacityMax="2"/>'));
  const baseWithXmp = prepend(base, packet(`<rdf:Description rdf:about="" xmlns:hdrgm="http://ns.adobe.com/hdr-gain-map/1.0/" hdrgm:Version="1.0" xmlns:Container="http://ns.google.com/photos/1.0/container/" xmlns:Item="http://ns.google.com/photos/1.0/container/item/"><Container:Directory><rdf:Seq><rdf:li rdf:parseType="Resource"><Container:Item Item:Semantic="Primary" Item:Mime="image/jpeg"/></rdf:li><rdf:li rdf:parseType="Resource"><Container:Item Item:Semantic="GainMap" Item:Mime="image/jpeg" Item:Length="${gain.length}"/></rdf:li></rdf:Seq></Container:Directory></rdf:Description>`));
  const mpf = Buffer.from(original.mpf);
  const index = mpfIndex(mpf);
  const baseLength = baseWithXmp.length + mpf.length;
  index.put(index.offset + 4, baseLength);
  index.put(index.offset + 8, 0);
  index.put(index.offset + 20, gain.length);
  index.put(index.offset + 24, baseLength - (2 + index.tiff));
  const result = Buffer.concat([prepend(baseWithXmp, mpf), gain]);
  splitGainmap(result);
  return result;
}
