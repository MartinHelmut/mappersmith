import { lowerCaseObjectKeys, assign } from './utils'

/**
 * @typedef Response
 * @param {Request} originalRequest, for auth it hides the password
 * @param {Integer} responseStatus
 * @param {String} responseData, defaults to null
 * @param {Object} responseHeaders, defaults to an empty object ({})
 */
function Response (originalRequest, responseStatus, responseData, responseHeaders, _timeline) {
  if (originalRequest.requestParams && originalRequest.requestParams.auth) {
    const maskedAuth = assign({}, originalRequest.requestParams.auth, { password: '***' })
    this.originalRequest = originalRequest.enhance({ auth: maskedAuth })
  } else {
    this.originalRequest = originalRequest
  }

  this.responseStatus = responseStatus
  this.responseData = responseData !== undefined ? responseData : null
  this.responseHeaders = responseHeaders || {}
  this.timeElapsed = null

  const completeTimeline = [...(this._timeline || []), ...(_timeline || [])]
  const gatewayEntry = completeTimeline.find(entry => entry.phase === 'gateway')
  const responseTimeline = completeTimeline.filter(entry => entry.phase === 'response')
  const requestTimeline = this.originalRequest.timeline ? this.originalRequest.timeline() || [] : []

  this._timeline = [...requestTimeline, gatewayEntry, ...responseTimeline].filter(entry => entry)
}

Response.prototype = {
  /**
   * @return {Request}
   */
  request () {
    return this.originalRequest
  },

  /**
   * @return {Integer}
   */
  status () {
    // IE sends 1223 instead of 204
    if (this.responseStatus === 1223) {
      return 204
    }

    return this.responseStatus
  },

  /**
   * Returns true if status is greater or equal 200 or lower than 400
   *
   * @return {Boolean}
   */
  success () {
    const status = this.status()
    return status >= 200 && status < 400
  },

  /**
   * Returns an object with the headers. Header names are converted to
   * lowercase
   *
   * @return {Object}
   */
  headers () {
    return lowerCaseObjectKeys(this.responseHeaders)
  },

  /**
   * Utility method to get a header value by name
   *
   * @param {String} name
   *
   * @return {String|Undefined}
   */
  header (name) {
    return this.headers()[name.toLowerCase()]
  },

  /**
   * Returns the original response data
   */
  rawData () {
    return this.responseData
  },

  /**
   * Returns the response data, if "Content-Type" is "application/json"
   * it parses the response and returns an object
   *
   * @return {String|Object}
   */
  data () {
    let data = this.responseData

    if (this.isContentTypeJSON()) {
      try { data = JSON.parse(this.responseData) } catch (e) {}
    }

    return data
  },

  isContentTypeJSON () {
    return /application\/json/.test(this.headers()['content-type'])
  },

  /**
   * Enhances current Response returning a new Response
   *
   * @param {Object} extras
   *   @param {Integer} extras.status - it will replace the current status
   *   @param {String} extras.rawData - it will replace the current rawStatus
   *   @param {Object} extras.headers - it will be merged with current headers
   *
   * @return {Response}
   */
  enhance (extras) {
    return new Response(
      this.request(),
      extras.status || this.status(),
      extras.rawData || this.rawData(),
      assign({}, this.headers(), extras.headers),
      extras._timeline
    )
  }
}

export default Response
