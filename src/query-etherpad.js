'use strict'

const request = require('request-promise-native')
const createError = require('http-errors')
const { inspect, debuglog } = require('util')

const logger = debuglog(`etherpad`)
// Talk to the last API version
// http://etherpad.org/doc/v1.7.0/#index_api_version
const ETHERPAD_URL = `pad.domain.com`
const TIMEOUT = 3000
const ETHERPAD_API_VERSION = `1.2.13`
const API_KEY = `f4f719f1b70f94c56b95f6d270bccee7d495250c0fe8ad2f742deebb8cecefc7`
const ETHERPAD_URI = `http://${ETHERPAD_URL}/api/${ETHERPAD_API_VERSION}`

//////
// REQUEST WRAPPER
//////

const err503Txt = `Etherpad est inaccessible. Soit il n'est pas lancé ou la configuration est mauvaise`
// http://etherpad.org/doc/v1.7.0/#index_response_format
const etherpadErrorCodes = {
  1: 422, // wrong parameters     => UnprocessableEntity
  2: 500, // internal error       => InternalServerError
  3: 501, // no such function     => NotImplemented
  4: 422, // no or wrong API Key  => UnprocessableEntity
}

const etherpadErrorMessages = {
  'groupID does not exist': `ce groupe n'existe pas dans Etherpad`,
  'authorID does not exist': `
    veuillez contacter l'admin :
    Vous êtes mal référencé sur Etherpad`,
  'padID does not exist': `cet article n'existe pas dans Etherpad`,
}
module.exports = queryEtherpad

async function queryEtherpad(method, qs = {}, throwOnEtherpadError = true) {
  const uri = `${ETHERPAD_URI}/${method}`
  const params = {
    uri,
    json: true,
    resolveWithFullResponse: true,
    timeout: TIMEOUT,
    qs: Object.assign({}, { apikey: API_KEY }, qs),
  }

  try {
    const response = await request(params)
    if (response.statusCode >= 400) {
      throw createError(response.statusCode, response.statusMessage)
    }
    const { body } = response
    body.code = +body.code

    if (body.code === 0) return body.data
    if (!throwOnEtherpadError) return body.data
    logger(`${method} doesn't work properly`, qs)
    logger(uri)
    const code = etherpadErrorCodes[body.code]
    const message = etherpadErrorMessages[body.message]
      ? etherpadErrorMessages[body.message]
      : JSON.stringify(body.message)
    console.log(inspect(body, { colors: true }))
    const error = createError(code, message)
    if (qs.padID) error.padCreationHref = `/pads/new?pad-name=${qs.padID}`
    throw error
  } catch (error) {
    logger(`error`)
    if (error.code === `ETIMEDOUT`) throw createError(408)
    if (error.code === `ECONNREFUSED`) throw createError(503, err503Txt)
    throw error
  }
}