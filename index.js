'use strict'

var types = require('./content-types.json')

function getContentType (itemType) {
  return types.filter(function (item) {
    return item.code === itemType
  })[0]
}

function getULongAt (arr, offs) {
  return (arr[offs + 0] << 56) +
      (arr[offs + 1] << 48) +
      (arr[offs + 2] << 34) +
      (arr[offs + 3] << 24) +
      (arr[offs + 4] << 16) +
      (arr[offs + 5] << 8) +
      arr[offs + 6] >>> 0
}
function getUIntAt (arr, offs) {
  return (arr[offs + 0] << 24) +
      (arr[offs + 1] << 16) +
      (arr[offs + 2] << 8) +
      arr[offs + 3] >>> 0
}

function decode (buffer, fullNames, startAt) {
  var output, itemType, itemLength, contentType, data, parsedData, outputKey
  if (!fullNames) {
    fullNames = false
  }
  if (startAt === undefined) 
    startAt = 8;

  output = decodeAll(buffer,startAt,fullNames);
  
  return output
}

function decodeAll(buffer, startAt, fullNames)
{
  var output = {};
  for (var i = startAt; i < buffer.length;) {
    var result = decodeChunk(buffer, i, fullNames);
    i = result.i;
    if (result.parsedData) {
      if (result.contentType && result.contentType.type === 'list')
      {
        if (!output[result.outputKey]) output[result.outputKey] = [];
        output[result.outputKey].push(result.parsedData);
      }
      else
        output[result.outputKey] = result.parsedData;
    }
  }
  return output;
}
// returns {
//  i:the next index to read (which can be >= buffer.length if we're done)
//  outputKey : the output key
//  parsedData:the parsed data
// }
function decodeChunk(buffer, i, fullNames)
{
    var itemType = buffer.slice(i, i + 4).toString()
    var outputKey = itemType.toString()
    var itemLength = buffer.slice(i + 4, i + 8).readUInt32BE(0)
    var contentType = getContentType(itemType)
    var parsedData = null;

    if (contentType) {
      parsedData = null

      if (itemLength !== 0) {
        var data = buffer.slice(i + 8, i + 8 + itemLength)
        try {
          if (contentType.type === 'byte') {
            if (itemLength != 1) console.error(contentType," received ",itemLength," not 1 bytes");
            else parsedData = data.readUInt8(0)
          } else if (contentType.type === 'date') {
            parsedData = data.readIntBE(0, 4)
          } else if (contentType.type === 'short') {
            parsedData = data.readUInt16BE(0)
          } else if (contentType.type === 'int') {
            if (itemLength != 4) console.error(contentType," received ",itemLength," not 4 bytes");
            else parsedData = data.readUInt32BE(0)
          } else if (contentType.type === 'long') {
            parsedData = data.readIntBE(0, 8)
          } else if (contentType.type === 'longlong') {
            parsedData = data.readIntBE(0, 16)
          } else if (contentType.type === 'list') {
            parsedData = decodeAll(data, 0, fullNames);
          } else {
            parsedData = data.toString();
          }
        } catch (e) {
          console.log('error on %s', itemType);
          console.log('itemLength: ' + itemLength);          
          console.error(e)
        }
      }
      if (fullNames) {
        outputKey = contentType.name
      }
    } else {
      console.error('Node-DAAP: Unexpected ContentType: %s', itemType);
    }

    i += 8 + itemLength;

    return {
      i: i,
      parsedData: parsedData,
      outputKey: outputKey,
      contentType: contentType
    }
}
function encode (field, value) {
  value = value.toString()
  console.error("FIELD", field);
  var contentType = getContentType(field)
  var buf = new Buffer(field.length + value.length + 4)

  buf.write(field, 0, field.length)
  buf.writeUInt32BE(value.length, field.length)

  var valueOffset = field.length + 4
  if (contentType.type === 'byte') {
    buf.writeUInt8(value, valueOffset)
  } else if (contentType.type === 'short') {
    buf.writeUInt16BE(value, valueOffset)
  } else if (contentType.type === 'int') {
    buf.writeUInt32BE(value, valueOffset)
  } else if (contentType.type === 'long') {
    buf.writeIntBE(value, valueOffset, 8)
  } else if (contentType.type === 'date') {
    buf.writeIntBE(value, valueOffset, 4)
  } else {
    buf.write(value, valueOffset, value.length)
  }
  return buf
}

function encodeList (field) {
  var values = Array.prototype.slice.call(arguments)
  values.shift()
  if (values[0] instanceof Array) {
    values = values[0]
  }
  var value = Buffer.concat(values)
  var buf = new Buffer(field.length + 4)
  buf.write(field, 0, field.length)
  buf.writeUInt32BE(value.length, field.length)
  return Buffer.concat([buf, value])
}

module.exports.encodeList = encodeList
module.exports.encode = encode
module.exports.decode = decode
