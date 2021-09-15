const puppeter = require('puppeteer')
const axios = require('axios').default
const readlineSync = require('readline-sync')

const executionParams = {
    username: 'dogdarebs@gmail.com',
    password: 'ArthurRARC2',
    // username: 'arthurdarebs@gmail.com',
    // password: 'ArthurRARC12',
    // username: 'vitin_36@hotmail.com',
    // password: 'Vitor102030',
    date: '2021-09-13 10:00:00',
    presetDate: '2021-09-13 09:53:00',
    preset: 'https://www.nike.com.br/tenis-nike-air-vapormax-2021-flyknit-masculino-153-169-223-324914',
    product: 'https://www.nike.com.br/air-force-1-07-lv8-emb-153-169-211-339053',
    phoneNumber: '34992291965',
    waitForSelector: {
        visible: true,
        timeout: 7500
    },
    waitForSelectorInvisible: {
        timeout: 7500
    },
    waitForResponse: {
        timeout: 5000
    }
}

const timeTo = (date) => {
    const now = new Date()
    const nextTime = new Date(date)
    const timeTo = (nextTime.getTime() - now.getTime())
    return {
        timeTo,
        times: {
            hours: Math.floor((timeTo / 1000) / 3600),
            minutes: Math.floor((timeTo / 1000) % 3600 / 60),
            seconds: Math.floor((timeTo / 1000) % 3600 % 60)
        }
    }
}

const schedule = async (date, executionType) => {
    const dateToExecute = timeTo(date)
    const interval = setInterval(function () {
        const response = timeTo(date)
        console.log(`${executionType} em :`)
        console.log(`${response.times.hours} hora(s), ${response.times.minutes} minuto(s) e ${response.times.seconds} segundo(s)`)
    }, 1000)
    await new Promise((resolve, reject) =>
        setTimeout(() => {
            clearInterval(interval)
            resolve()
        }, dateToExecute.timeTo))
    return
}

const infineRetry = async (func, params = {}, timeoutRetry = 0) => {
    let success = false
    console.log('Infinite retry', func)
    while (!success) {
        try {
            return await func(params)
        }
        catch (e) {
            success = false
            timeoutRetry ? await schedule(new Date(new Date().getTime() + timeoutRetry), func) : null
        }
    }
}

const executeOrLog = async (func, params, _finnaly) => {
    try {
        return await func(params)
    }
    catch (e) {
        console.log('Error executing function: ', func)
        console.log(e)
        throw Error(e)
    }
    finally {
        _finnaly ? await _finnaly() : undefined
    }
}

const initBrowser = async () => {
    const args = ['--no-sandbox', '--disable-notifications',
        '--start-maximized']
    const browser = await puppeter.launch({
        headless: false,
        defaultViewport: null,
        args
    })
    return browser
}

const login = async (browser) => {
    const params = {
        loginPage: 'https://www.nike.com.br',
        loginPageButton: "#anchor-acessar-unite-oauth2",
        loginEmail: 'input[name=emailAddress]',
        loginPassword: 'input[name=password]',
        loginButton: 'input[value="ENTRAR"]',
        homePage: 'main#home'
    }
    const loginFlow = async (page) => {
        await page.goto(params.loginPage)
        await page.waitForSelector(params.loginPageButton, executionParams.waitForSelector)
        await page.click(params.loginPageButton)

        await page.waitForSelector(params.loginEmail, executionParams.waitForSelector)
        await page.waitForSelector(params.loginPassword, executionParams.waitForSelector)
        await page.waitForSelector(params.loginButton, executionParams.waitForSelector)

        await page.$eval(params.loginEmail, (el, param) => el.value = param, executionParams.username)
        await page.$eval(params.loginPassword, (el, param) => el.value = param, executionParams.password)
        await page.click(params.loginButton)

        await page.waitForResponse(response => {
            return response.url().includes('/login') && response.ok() ? true : false
        }, executionParams.waitForResponse)

        await page.waitForSelector(params.homePage, executionParams.waitForSelector)
        const response = await page.waitForResponse(response => {
            return response.url().includes('/Requisicao/Ajax' && response.ok() ? true : false)
        })
        const cookies = await page.cookies()
        const request = response.request()
        return { response, cookies, request }
    }

    const page = await browser.newPage()
    return await executeOrLog(loginFlow, page, async () => { await page.close() })
}

const getDeliveryInformations = async (browser) => {
    const params = {
        url: 'https://www.nike.com.br/checkout',
        deliveryAddressInput: '#calcularFreteCallback',
        deliveryIdInput: '#user-shipping-address-id'
    }
    const deliveryFlow = async (page) => {
        await page.goto(params.url)
        await page.waitForSelector(params.deliveryAddressInput, executionParams.waitForSelectorInvisible)
        await page.waitForSelector(params.deliveryIdInput, executionParams.waitForSelectorInvisible)
        const getInputValue = (input) => input.getAttribute('value')
        const deliveryAddress = await page.$eval(params.deliveryAddressInput, getInputValue)
        const deliveryId = await page.$eval(params.deliveryIdInput, getInputValue)
        return {
            id: deliveryId,
            address: deliveryAddress
        }
    }

    const page = await browser.newPage()
    return await executeOrLog(deliveryFlow, page, async () => { await page.close() })
}

const getProductInfo = async ({ cookie, url }) => {
    const headers = {
        cookie,
        referer: url,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: 'https://www.nike.com.br',
    }
    const { data } = await axios({
        method: 'post',
        url: 'https://www.nike.com.br/Requisicao/Ajax',
        headers
    })
    if (!data || !data.Carrinho_Resumo) throw Error('Failed to getProductInfo')
    return data
}

const cartAdd = async ({ cookie, productId, referer, twoFactorId }) => {
    const headers = {
        cookie,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: 'https://www.nike.com.br',
        referer
    }
    const dataRequest = `EPrincipal=${productId}&EAcessorio%5B%5D=&ECompreJunto%5B%5D=&AdicaoProdutoId=&Origem=&SiteId=106&g-recaptcha-response=`
    const { data } = await axios({
        method: 'post',
        url: 'https://www.nike.com.br/Carrinho/Adicionar',
        data: dataRequest,
        headers
    })

    if (!data.success && data.twoFactorAuth) {
        await executeOrLog(twoFactorGenerate, { cookie, referer, productId: twoFactorId })
        const code = await readlineSync.question("Codigo de autenticação: \n", {
            limit: (input) => input.length === 6,
            limitMessage: 'Codigo de autenticação deve ter 6 caracteres'
        })
        await executeOrLog(twoFactorConfirm, { cookie, referer, productId: twoFactorId, code })

    }

    if (!data || !data.success) {
        console.log('Failed cartAdd response: ', data)
        throw Error(`Failed to cartAdd for ${referer}`)
    }

    return data
}
const twoFactorGenerate = async ({ cookie, referer, productId }) => {
    const headers = {
        cookie,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: 'https://www.nike.com.br',
        referer
    }
    const dataRequest = `CelularCliente=${executionParams.phoneNumber}&ProdutoId=${productId}`
    const { data } = await axios({
        method: 'post',
        url: 'https://www.nike.com.br/auth/two-factor/generate',
        headers,
        data: dataRequest
    })

    if (!data || !data.valid) {
        console.log('Failed to generate two factor code: ', data)
    }

    return
}

const twoFactorConfirm = async ({ cookie, referer, productId, code }) => {
    const headers = {
        cookie,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: 'https://www.nike.com.br',
        referer
    }
    const dataRequest = `NumberCode=${code}&ProdutoId=${productId}`
    const { data } = await axios({
        method: 'post',
        url: 'https://www.nike.com.br/auth/two-factor/validate',
        headers,
        data: dataRequest
    })

    if (!data || !data.valid) {
        console.log('Failed to generate two factor code: ', data)
    }

    return
}

const calculateDelivery = async ({ cookie, cep }) => {
    const headers = {
        cookie,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: 'https://www.nike.com.br',
    }
    const { data } = await axios({
        method: 'post',
        url: 'https://www.nike.com.br/Frete/CalcularFretePromocao',
        headers,
        data: `cep=${cep}`
    })
    if (!data || !data.success) throw Error('Failed to calculateDelivery')
    const [frete] = data.frete
    return frete.TipoEntrega
}

const selectDelivery = async ({ cookie, deliveryType }) => {
    const headers = {
        cookie,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: 'https://www.nike.com.br',
    }
    const dataRequest = `hash=&tipoEntrega=${deliveryType}`
    const response = await axios({
        method: 'post',
        url: 'https://www.nike.com.br/Frete/EscolheFreteCarrinho',
        data: dataRequest,
        headers
    })
    const { data } = response
    if (!data || !data.success) {
        console.log('Failed selectDelivery response: ', response)
        throw Error('Failed to selectDelivery')
    }
    return data
}

const findCarts = async ({ cookie }) => {
    const headers = {
        cookie,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: 'https://www.nike.com.br',
    }
    const requestResponse = await axios({
        method: 'post',
        url: 'https://www.nike.com.br/Checkout/VerificaCartoesSalvos',
        headers
    })
    const { data } = requestResponse
    if (!data || !data.success) {
        console.log('Failed findCarts response: ', response)
        throw Error('Failed to findCarts')
    }
    const [firstCard] = data.dados
    const response = {
        brand: firstCard.Bandeira,
        id: firstCard.CartaoCreditoId,
        lastDigits: firstCard.UltimosDigitos
    }
    return response
}

const buyProduct = async ({ cookie, cardInformations, deliveryInformations }) => {
    const headers = {
        cookie,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: 'https://www.nike.com.br',
        referer: 'https://www.nike.com.br/checkout'
    }
    const dataRequest = `MeioPagamentoId=1&ClearsaleFingerprint=&TipoVale=&SalvarCartao=0&CartaoCreditoId=${cardInformations.id}&UltimosDigitos=${cardInformations.lastDigits}&EnderecoId=${deliveryInformations.id}&Utm%5BUtmSource%5D=Direct&Utm%5BUtmMedium%5D=&Utm%5BUtmTerm%5D=&Utm%5BUtmCp%5D=&Utm%5BUtmContent%5D=&Utm%5BUtmCampaign%5D=&Bandeira=${cardInformations.brand}&Bandeira_2=&Nome=&Nome_2=&NumCartao1=&NumCartao1_2=&ValidadeMesAno=%2F&ValidadeMesAno2=null%2Fnull&CodSeguranca=&CodSeguranca_2=&Parcelamento=1&Parcelamento_2=&DocumentoPortador=&DocumentoPortador2=&DoisCartoes=0&ValorCartao_1=&ValorCartao_2=&ShippingType=Normal`
    const response = await axios({
        method: 'post',
        url: 'https://www.nike.com.br/Pagamento/gravarPedido',
        headers,
        data: dataRequest
    })
    const { data } = response
    if (!data || !data.success) {
        console.log('Failed buyProduct response', response)
        throw Error('Failed to buyProduct')
    }
    return data
}

const clearCart = async ({ cookie, productId }) => {
    const headers = {
        cookie,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: 'https://www.nike.com.br',
    }
    const dataRequest = `Codigo=${productId}&SiteId=106&customid=`
    const response = await axios({
        method: 'post',
        url: 'https://www.nike.com.br/Carrinho/Excluir',
        headers,
        data: dataRequest
    })
    const { data } = response
    if (!data || !data.success) {
        console.log('Failed clearCart response', response)
        throw Error('Failed to clearCart')
    }
    return data
}

const getProductId = async ({ data, tamanho }) => {
    const productDetails = JSON.parse(data.DetalheProduto).variacoesProduto
    const inputRegex = `<input type="radio" class="tamanho__item_pdp js-tamanho__item_pdp" data-tamanho="${tamanho}"(.*?)(.*?)>`
    const codigoProdutoRegex = `data-codigoproduto="(.*?)"`
    const [inputRegexResult] = productDetails.match(inputRegex)
    const [codigoProdutoRegexResult, codigoProduto] = inputRegexResult.match(codigoProdutoRegex)
    return codigoProduto
}

const getProductTwoFactorId = async ({ data, tamanho }) => {
    const productDetails = JSON.parse(data.DetalheProduto).variacoesProduto
    const inputRegex = `<input type="radio" class="tamanho__item_pdp js-tamanho__item_pdp" data-tamanho="${tamanho}"(.*?)(.*?)>`
    const linkProdutoRegex = `value="(.*?)"`
    const [inputRegexResult] = productDetails.match(inputRegex)
    const [codigoProdutoRegexResult, value] = inputRegexResult.match(linkProdutoRegex)
    const productId = value.split('-').pop()
    return productId
}

const bot = async () => {

    //login and cookies
    await schedule(executionParams.presetDate, 'Preset')
    const browser = await executeOrLog(initBrowser)
    const loginInformations = await infineRetry(login, browser)
    const cookie = loginInformations.cookies.map(ck => `${ck.name}=${ck.value}`)
    // const cookie = 'name=value; nikega=GA1.4.216108932.1628772392; chaordic_browserId=0-55FPfpNMpfkLYoUuDThG3Hhwu2HpfLl7KTRI16287723926184849; chaordic_anonymousUserId=anon-0-55FPfpNMpfkLYoUuDThG3Hhwu2HpfLl7KTRI16287723926184849; chaordic_testGroup=%7B%22experiment%22%3Anull%2C%22group%22%3Anull%2C%22testCode%22%3Anull%2C%22code%22%3Anull%2C%22session%22%3Anull%7D; AMCVS_F0935E09512D2C270A490D4D%40AdobeOrg=1; Campanha=; Midia=; s_cc=true; _gcl_au=1.1.1503688976.1628772394; _fbp=fb.2.1628772394608.1374195518; user_unic_ac_id=1821f265-c7e5-e9aa-5161-bd5e4591f4d2; advcake_trackid=fad87e3f-28d9-0165-6c07-2ac931387007; lmd_orig=direct; blueID=7e836ba6-c812-4d3a-8c11-ceaf7e86e2e8; sback_client=5816989a58791059954e4c52; sback_partner=false; sb_days=1628772397356; smeventsclear_16df2784b41e46129645c2417f131191=true; _ga=GA1.3.216108932.1628772392; name=value; __pr.cvh=2-Cczzthp9; SIZEBAY_SESSION_ID_V4=0E824A6C9E8908b421765a1442d09815be5467f5fbfd; __privaci_cookie_consent_uuid=ecc55924-4645-466b-8216-73ea33941a37:2; __privaci_cookie_consent_generated=ecc55924-4645-466b-8216-73ea33941a37:2; __privaci_cookie_consents={"consents":{"127":1,"129":1,"130":1,"132":1},"location":"SP#BR","lang":"pt-br"}; _ce.s=v11slnt~1628775642922; sback_pageview=false; IFCSHOPSESSID=ap0tvisfo2i376lvm2qai56ftv; chaordic_session=1630931273958-0.367251263950106; AMCV_F0935E09512D2C270A490D4D%40AdobeOrg=-1124106680%7CMCIDTS%7C18877%7CMCMID%7C17641837100247587343076244177878306586%7CMCAAMLH-1631536073%7C4%7CMCAAMB-1631536073%7CRKhpRz8krg2tLO6pguXWp5olkAcUniQYPHaMWWgdJ3xzPWQmdj0y%7CMCOPTOUT-1630938473s%7CNONE%7CvVersion%7C5.2.0; nikega_gid=GA1.4.447666657.1630931274; _gid=GA1.3.1651992830.1630931274; _st_ses=04497448599601639; _sptid=1592; _spcid=1592; _st_cart_script=helper_nike.js; _st_cart_url=/; _st_id=bmV3LmV5SjBlWEFpT2lKS1YxUWlMQ0poYkdjaU9pSklVekkxTmlKOS5leUpsYldGcGJDSTZJbVJ2WjJSaGNtVmljMEJuYldGcGJDNWpiMjBpZlEuSExxZXdrNzVxQjBYUFNDYkY2eFpWVW5jVHF1SFpISjMxaHRKZ3JBN1RNMC5XcldydXlLcXFCSGVLcVdyZ1BFaWlZ; _cm_ads_activation_retry=false; sback_browser=0-20060900-1630931279061e80efc111f70f87a4642ace34dad055973b2717048638836136094f30fb19-92521223-17024428240,1301764072-1630931279; sback_customer=$2QcyIVRhRVVNhWMzVkNE90TQlXMNJ1Rj9UWwoUVFp2RZBFerlFaycnT30mZChHV48kd3ZURa1WQNdnMvtWWE5UT2$12; sback_access_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGkuc2JhY2sudGVjaCIsImlhdCI6MTYzMDkzMTI4MCwiZXhwIjoxNjMxMDE3NjgwLCJhcGkiOiJ2MiIsImRhdGEiOnsiY2xpZW50X2lkIjoiNTgxNjk4OWE1ODc5MTA1OTk1NGU0YzUyIiwiY2xpZW50X2RvbWFpbiI6Im5pa2UuY29tLmJyIiwiY3VzdG9tZXJfaWQiOiI2MTE1MTgyYzg0NWIxZjdmMDkwYTI2OTAiLCJjdXN0b21lcl9hbm9ueW1vdXMiOmZhbHNlLCJjb25uZWN0aW9uX2lkIjoiNjExNTE4MmM4NDViMWY3ZjA5MGEyNjkxIiwiYWNjZXNzX2xldmVsIjoiY3VzdG9tZXIifX0.k1BeF1VZo4rOgLg-WZPfcv-xqHKFjTPmqzZ9yShWV-I.WrWruyKqqBHeKqWrgPiYqB; sback_session=613609501e1539535710005b; sback_customer_w=true; sback_refresh_wp=no; sback_cart=61360e434d3c43aeee54e997; bm_sz=91BEF1172836A0DACC1A8571FE654744~YAAQLNXaF7cc7XF7AQAAL2Eouw3Pa5OaDFVkJ2hVIbSUB95hSiKGMCoL9/rwf6kpSfPoU9B8j1qyiPT4SYn8ivvDomcjPTkwRQ4NIhC3jCjpGGYDsiLadKbSHmAasq5ajoKMbCgI/TfExYOFsytGezJjksx60Zu0YGbnmyjnu8USkxOFi3ABQQ4+7O5jm5UU+h/Sbd1dN3nTOHwbEC1yMo+n3XZdYL3GyG1EKFJqIegrHJQC/7aE9D4XKqLIgl7DyC6CQjqxjxhiVM7O6xyL/7QzmX7qPDMTuBI2yDOxiKQH4VXezFJwhT9QSnwvnQC+m7DaK8/u4e7bM2yCc7Ia9f6XhCkFm6CxNbV0k3slXNoQJZW5bzQq2BwPHtVFXXE5EamaYEnsyA==~4338242~3354932; _abck=C294291BB5F7CACA91870AE707BDADD3~-1~YAAQLNXaF5Qo7XF7AQAAwakouwZA7XW7rLf6frZX8N5IsZA1gaui1LdgKzqb7YyQ5eW83P10ESpEwZSnRjVh9IlscYvVtbCZP4+q/zeuQ3+kLE+p13kku7Zn4t8bsrGCzBJWbmDsGbbW4VqmpqTZCSLNxmq+w7X60cMhdZxeX7jiLUZ1dXfuydDszCaQ0o63uGqg9A8lHcRHL/3RGcpmH+waMPLWFFKV6lVNzX0tz3w1hM5OKYOulq/5APUBzPNMYQgpxKajJl2B5ifHsXTyxeiYtEq1Mdj+ru+pg5UZ82PHRRTr4AvaGpBMRhIv6fYwwdoZBt4cwk60ePp6MiVxnFmTBNjDd2+cudf/hMwJorRU7BlA8nF3W3spQ0qQwcIjKsstIglqiNsJF9YHIU8dM0GQhHLH76T9fyaVzLECL9FEFCLGhvZO5+6mwanesJ0TZRY5YJGR5VMlTpzJnlvE8sHLTMqG6uNJvkDqiCIb3y5Gr/CfyXFfvz8436OFN+/TAfM3o7wJ2c7B3hA=~-1~-1~-1; isLogged=1; isLogged=true; sback_current_session=1; sback_total_sessions=25; chaordic_realUserId=4136319; lx_sales_channel=%5B%222%22%5D; __udf_j=50e11a5eadfb7600c5eb4e7e31a08cd6fc565d114e8f3618362c108aecddbe8346ef750cb5279cfe86c89e4a6a445260; gpv_v70=nikecombr%3Echeckout%3Ecart; pv_templateName=CART; gptype_v60=cart; _st_idb=bmV3LmV5SjBlWEFpT2lKS1YxUWlMQ0poYkdjaU9pSklVekkxTmlKOS5leUpsYldGcGJDSTZJbVJ2WjJSaGNtVmljMEJuYldGcGJDNWpiMjBpZlEuSExxZXdrNzVxQjBYUFNDYkY2eFpWVW5jVHF1SFpISjMxaHRKZ3JBN1RNMC5XcldydXlLcXFCSGVLcVdyZ1BFaWlZ; lmd_traf=direct-1630936813312&direct-1630936820439&direct-1630937837111&direct-1630937909870; s_sq=%5B%5BB%5D%5D; _uetsid=dcba15300f0d11ec819c9179f71da488; _uetvid=537e67f0fb6b11eb94c87dc474f63058; stc119288=env:1630931276%7C20211007122756%7C20210906145304%7C39%7C1088071:20220906142304|uid:1628772395091.1929272745.11269.119288.1041404097.9:20220906142304|srchist:1088071%3A1630931276%3A20211007122756:20220906142304|tsa:1630931276276.960668097.5939989.39894466550971996.:20210906145304; _spl_pv=366; CSRFtoken=e05316abb772ada4656095fcb3b97395; ak_bmsc=121A52D582CC413FB2D80D23D8C89514~000000000000000000000000000000~YAAQ3dhHaOfl7nh7AQAACnmFuw3/FJOGP/OH+Toglkpg0519VJRz2lA4FC8MH5LpRa+HA5+y/b8IdmCKzAMRk2l2Uh8cY6CxnjUSc8ymLvUMG3nF2OzGPEU7GO/SQ7TSOnzHkrGoxlXs8nvrDDWaUCLpJJZskiQ2VVLz/zFj6N1jwsOWR8dPhJNGh+q9lNn2TwPrD4kYJwNEm/xAdxNzHRy2UiTGzA1LtRMKcmnNTqVEWjRdpHOJOd4YtuK37CM+YdmcSHWs4WjbIKjKiVzf2tF/vn6ezW17q0yOsqYZqgB+lCjSd7B8RcQqEyDmZ9fqY62uYX2yayW0aTtXH7B4GBSUbgoF0BEqHhAYHFtM5gqITyraJrHYZqsYjdY2M0/gm0PeCY79Pma5tVtR; RT="z=1&dm=nike.com.br&si=a9bc2867-2907-497f-b2cc-19afeee57e65&ss=kt8q9z3z&sl=8&tt=9q4&bcn=%2F%2F173e2515.akstat.io%2F&obo=1&ul=icmj&hd=idca"'

    //preset product infos

    const getPresetProductInfoFn = async () => await executeOrLog(getProductInfo, { cookie, url: executionParams.preset })
    const presetProductResponse = await infineRetry(getPresetProductInfoFn)
    const presetProductId = await executeOrLog(getProductId, { data: presetProductResponse, tamanho: 38 })
    const presetCartAddFn = async () => await executeOrLog(cartAdd, { cookie, referer: executionParams.preset, productId: presetProductId })
    const cartAddResponse = await infineRetry(presetCartAddFn)

    //delivery and payment infos

    const getDeliveryInformationFn = async () => await executeOrLog(getDeliveryInformations, browser)
    const deliveryInformations = await infineRetry(getDeliveryInformationFn)
    await browser.close()
    const calculateDeliveryFn = async () => await executeOrLog(calculateDelivery, { cookie, cep: deliveryInformations.address })
    const calculateDeliveryResponse = await infineRetry(calculateDeliveryFn)
    const selectDeliveryFn = async () => await executeOrLog(selectDelivery, { cookie, deliveryType: calculateDeliveryResponse })
    const selectDeliveryResponse = await infineRetry(selectDeliveryFn)
    const findCartsFn = async () => await executeOrLog(findCarts, { cookie })
    const cardInformations = await infineRetry(findCartsFn)
    const clearCartFn = async () => executeOrLog(clearCart, { cookie, productId: presetProductId })

    //clear cart after preset

    const clearCartResponse = await infineRetry(clearCartFn)

    //product infos
    await schedule(executionParams.date, 'Product Info')
    const getProductInfoFn = async () => await executeOrLog(getProductInfo, { cookie, url: executionParams.product })
    const productResponse = await infineRetry(getProductInfoFn, {}, 15000)
    const productId = await executeOrLog(getProductId, { data: productResponse, tamanho: 40 })
    const twoFactorProductId = await executeOrLog(getProductTwoFactorId, { data: productResponse, tamanho: 40 })
    const cartAddFn = async () => await executeOrLog(cartAdd, { cookie, referer: executionParams.product, productId: productId, twoFactorId: twoFactorProductId })
    const productCartAddResponse = await infineRetry(cartAddFn, {}, 15000)
    console.log(productCartAddResponse)

    // bough product

    const buyProductFn = async () => await executeOrLog(buyProduct, { cookie, cardInformations, deliveryInformations })
    const buyResult = await infineRetry(buyProductFn, {}, 15000)
    return
}

bot()