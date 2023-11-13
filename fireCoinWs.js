(function () {
  class FireCoinWs {
    static socket = null
    static events = {}
    // 所有币种的最新价格
    static allCoinNewPrice = {}
    // 当前币种的交易数据
    static allTradeDetail = []

    initFireCoinWs () {
      if (!this.socket) {
        this.socket = new WebSocket('wss://api.huobi.pro/ws')
        this.socket.onopen = () => {
          console.log('创建连接成功')
        }
        this.socket.onmessage = (res) => {
          this.parseResult(res)
        }
        this.socket.onclose = () => {
          this.socket = null
          this.close()
        }
        this.socket.onerror = (err) => {
          this.socket = null
          this.error(err)
        }
      }
      return this
    }
    // 解析返回的数据
    parseResult (res) {
      const reader = new FileReader()
      reader.onload = () => {
        const msg = JSON.parse(window.pako.ungzip(reader.result, { to: 'string' }))
        console.log(msg, 'msg')
        if (msg.ping) {
          this.doPeng(msg)
        }
        // 处理k线图数据
        if (msg.ch && msg.ch.includes('kline')) {
          this.parseDateKline(msg)
          // 实时交易数据
        } else if (msg.ch && msg.ch.includes('trade.detail')) {
          this.parseDateTradeDetail(msg)
        } else if (msg.ch && msg.ch.includes('depth')) {
          this.parseDateDepth(msg)
        }
      }
      reader.readAsArrayBuffer(res.data)
    }
    parseDateKline (msg) {
      if (msg.ch.includes('1min')) {
        // 如果需要存全部的数据
        if (this.events['getAllCoinNewPrice']) {
          const coinName = this.getCoinName(msg.ch)
          this.allCoinNewPrice[coinName] = msg.tick
          // 把数据返回回去
          this.emit('getAllCoinNewPrice', this.allCoinNewPrice)
        } else {
          this.allCoinNewPrice = {}
        }
      }
    }
    parseDateTradeDetail (msg) {
      // console.log(msg)
      if (this.events['getAllTradeDetail']) {
        this.allTradeDetail = msg.tick.data.sort((a, b) => a.amount - b.amount).concat(this.allTradeDetail).slice(0, 100)
        // 把数据返回回去
        this.emit['getAllTradeDetail'](this.allTradeDetail)
      } else {
        this.allTradeDetail = []
      }
    }

    parseDateDepth (msg) {
      if (this.events['getDepth']) {
        // 把数据返回回去
        this.emit['getDepth']({
          asks: msg.tick.asks.reverse(),
          bids: msg.tick.bids
        })
      }
    }

    getCoinName (ch) {
      const symbol = ch.split('.')[1]
      let coinName = symbol.slice(0, -3)
      if (symbol.includes('USDT') || symbol.includes('usdt')) {
        coinName = symbol.slice(0, -4)
      }
      return coinName
    }

    // 订阅某个币种的k线数据
    subscriptionKline ({ coinName, time }) {
      this.sendWsRequest({
        sub: `market.${coinName}.kline.${time}`,
        id: 'id1'
      })
      return this
    }
    // 订阅某个币种的最新交易数据
    subscriptionDetail ({ coinName }) {
      this.sendWsRequest({
        symbol: coinName,
        sub: `market.${coinName}.trade.detail`,
        id: 'id2'
      })
      return this
    }
    // 订阅某个币种的深度图数据
    subscriptionDepth ({ coinName, depth = 'step0' }) {
      this.sendWsRequest({
        symbol: coinName,
        sub: `market.${coinName}.depth.${depth}`,
        id: 'id3'
      })
      return this
    }

    on (eventName, func) {
      this.events[eventName] = func
      return this
    }
    off (eventName) {
      delete this.events[eventName]
      return this
    }
    emit (eventName, data) {
      this.events[eventName] && this.events[eventName](data)
    }

    // count 是ws连接出现异常重新发送次数
    sendWsRequest (params, count = 0) {
      switch (this.socket.readyState) {
        case 0:
          if (count <= 10) {
            setTimeout(() => {
              console.log('尝试发送', count)
              this.sendWsRequest(params, ++count)
            }, 2000);
          }
          break
        case 1:
          this.socket.send(JSON.stringify(params))
          break
        case 2:
          console.log('ws正在关闭')
          break
        case 3:
          this.initFireCoinWs()
          break
        default:
          console.log('ws未知错误')
      }
    }

    doPeng (msg) {
      this.socket.send(JSON.stringify({ pong: msg.ping }))
    }

    error (err) {
      console.log('depth-socket::error', this.lastDepthCoin, err)
    }

    close () {
      console.log('depth-socket::close', this.coin)
      // 如果websocket关闭的话，就从新打开一下。
      this.initFireCoinWs()
    }
  }
  window.FireCoinWs = new FireCoinWs()
  console.log('dddd', window.FireCoinWs)
})();