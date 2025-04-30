const axios = require('axios');
const { RateLimiter } = require('limiter');

class TikTokApiClient {
  constructor() {
    this.baseUrl = 'https://business-api.tiktok.com';
    this.accessToken = process.env.ACCESS_TOKEN;

    if (!this.accessToken) {
      throw new Error('TikTok Access Token not found in environment variables.');
    }

    // Initialize rate limiters for specific endpoints
    this.rateLimiters = {
      // 5 requests per second for ad creation
      '/open_api/v1.3/ad/create/': new RateLimiter({
        tokensPerInterval: 5,
        interval: 'second'
      }),
      // Default rate limiter for other endpoints (adjust as needed)
      'default': new RateLimiter({
        tokensPerInterval: 10,
        interval: 'second'
      })
    };

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Access-Token': this.accessToken,
        'Content-Type': 'application/json'
      }
    });
  }

  async request({ path, method = 'POST', payload = {}, extraConfig = {} }) {
    try {
      // Get the appropriate rate limiter for this endpoint
      const limiter = this.rateLimiters[path] || this.rateLimiters['default'];
      
      // Remove tokens (will wait if necessary)
      await limiter.removeTokens(1);

      const response = await this.client.request({
        method,
        url: path,
        data: method === 'GET' ? undefined : payload,
        params: method === 'GET' ? payload : undefined,
        headers: { ...this.client.defaults.headers, ...(extraConfig.headers || {}) },
        ...extraConfig
      });
      return response.data;
    } catch (error) {
      console.error(`TikTok API Error [${method} ${path}]:`, error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = TikTokApiClient;
