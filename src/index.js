const axios = require('axios').default
const readlineSync = require('readline-sync')

const executionParams = {
    date: '2021-10-26 10:00:00',
    presetDate: '2021-10-26 09:40:00',
    preset: 'https://www.nike.com.br/tenis-nike-pegasus-trail-3-masculino-153-169-224-324706?gridPosition=G1',
    product: 'https://www.nike.com.br/sb-dunk-low-513-514-515-367682',
    presetNumber: 38,
    productNumber: 42,
    phoneNumber: '34492291965',
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
        loginPage: 'https://www.nike.com/pt/login?continueUrl=https://www.nike.com/pt/member/settings/communication-preferences',
        loginPageButton: "#anchor-acessar-unite-oauth2",
        loginEmail: 'input[name=emailAddress]',
        loginPassword: 'input[name=password]',
        loginButton: 'input[value="INICIAR SESSÃO"]',
        homePage: 'main#home'
    }
    const loginFlow = async (page) => {

        await page.waitForTimeout(120000)
        await page.goto(params.loginPage)
        // await page.waitForSelector(params.loginPageButton, executionParams.waitForSelector)
        // await page.click(params.loginPageButton)

        await page.waitForSelector(params.loginEmail, 30000)
        await page.waitForSelector(params.loginPassword, 30000)
        await page.waitForSelector(params.loginButton, 30000)

        await page.$eval(params.loginEmail, (el, param) => el.value = param, executionParams.username)
        await page.$eval(params.loginPassword, (el, param) => el.value = param, executionParams.password)
        await page.click(params.loginButton)

        await page.waitForTimeout(100000)

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

const getDeliveryInformations = async ({ cookie }) => {
    const headers = {
        cookie,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: 'https://www.nike.com.br',
    }
    const { data } = await axios({
        method: 'post',
        url: 'https://www.nike.com.br/checkout',
        headers,
        timeout: 60000
    })
    const inputCepRegex = `<input type="hidden" id="calcularFreteCallback"(.*?)>`
    const valorCepRegex = `value="(.*?)"`
    const [inputCepRegexResult] = data.match(inputCepRegex)
    const [ignore, deliveryAddress] = inputCepRegexResult.match(valorCepRegex)

    const inputAddressIdRegex = `<input type="hidden" id="user-shipping-address-id"(.*?)>`
    const valorAddressIdRegex = `value="(.*?)"`
    const [inputAddressIdRegexResult] = data.match(inputAddressIdRegex)
    const [ignoreToo, deliveryId] = inputAddressIdRegexResult.match(valorAddressIdRegex)

    if (!data || !deliveryAddress || !deliveryId) throw Error('Failed to getDeliveryInformations')
    return {
        id: deliveryId,
        address: deliveryAddress
    }
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
        headers,
        timeout: 60000
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
        headers,
        timeout: 60000
    })

    if (!data.success && data.twoFactorAuth) {

        const twoFactor = async () => await executeOrLog(twoFactorGenerate, { cookie, referer, productId: twoFactorId })
        await infineRetry(twoFactor)
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
        data: dataRequest,
        timeout: 60000
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
        data: dataRequest,
        timeout: 60000
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
        headers,
        timeout: 60000
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
        headers,
        timeout: 60000
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
        data: dataRequest,
        timeout: 60000
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
        data: dataRequest,
        timeout: 60000
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

    // const browser = await executeOrLog(initBrowser)
    // const loginInformations = await infineRetry(login, browser)
    // const cookie = loginInformations.cookies.map(ck => `${ck.name}=${ck.value}`)

    const cookie = 'name=value; Campanha=; Midia=; name=value; nikega=GA1.4.439398858.1633786578; _ga=GA1.3.439398858.1633786578; s_cc=true; __pr.cvh=vqnlvq3jr6; SIZEBAY_SESSION_ID_V4=1643A8ECAD39fd34398a8727414b8dbd7070f1b8331e; _gcl_au=1.1.1205611723.1633786580; user_unic_ac_id=8c322c28-2d50-68bb-1570-292c2acb14c9; advcake_trackid=da96c412-011a-d58c-0e20-587d4bcc474e; _fbp=fb.2.1633786626324.807380073; sb_days=1633786627964; smeventsclear_16df2784b41e46129645c2417f131191=true; AMCVS_F0935E09512D2C270A490D4D%40AdobeOrg=1; chaordic_testGroup=%7B%22experiment%22%3Anull%2C%22group%22%3Anull%2C%22testCode%22%3Anull%2C%22code%22%3Anull%2C%22session%22%3Anull%7D; chaordic_browserId=0-wDHuHy0431YKd4aWk1TGs3IvqI4TngZzWE1_16337869484713722; chaordic_anonymousUserId=anon-0-wDHuHy0431YKd4aWk1TGs3IvqI4TngZzWE1_16337869484713722; blueID=dcfc3510-f641-43ab-9594-9e4b66a89880; _pin_unauth=dWlkPU5HSTFOR0ZrWkRBdE9EVmhPUzAwTkdRNExXRXhZV1l0T0RjMVpHRTFOMll4TTJNMA; __privaci_cookie_consent_uuid=e3109125-3321-4ddc-b10a-79c30dc1e98f:2; __privaci_cookie_consent_generated=e3109125-3321-4ddc-b10a-79c30dc1e98f:2; sback_client=5816989a58791059954e4c52; sback_partner=false; IFCSHOPSESSID=2eo4v268q43arnuiq0qefqui6g; nikega_gid=GA1.4.890475087.1634767673; _gid=GA1.3.1862098394.1634767673; sback_browser=0-79185500-16347680053233f97b3858a1a6a36005293da24fe6abbf9382119942834061709485c154b3-26981300-200170183117,130176164160-1634768005; _cm_ads_activation_retry=false; sback_customer=$2gTyoWRvp2VOVme4FVSq5mTCtWbkRHVUllNxMWVqRFSPF1aBZFTU9mTmFjTNl0Rw8UR6JUS2RlNalHa45kcqlmW2$12; sback_access_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGkuc2JhY2sudGVjaCIsImlhdCI6MTYzNDc2ODAwNiwiZXhwIjoxNjM0ODU0NDA2LCJhcGkiOiJ2MiIsImRhdGEiOnsiY2xpZW50X2lkIjoiNTgxNjk4OWE1ODc5MTA1OTk1NGU0YzUyIiwiY2xpZW50X2RvbWFpbiI6Im5pa2UuY29tLmJyIiwiY3VzdG9tZXJfaWQiOiI2MTYzNDZkN2E1NTlkNTU1YzgzMmVhM2YiLCJjdXN0b21lcl9hbm9ueW1vdXMiOnRydWUsImNvbm5lY3Rpb25faWQiOiI2MTYzNDZkN2E1NTlkNTU1YzgzMmVhNDAiLCJhY2Nlc3NfbGV2ZWwiOiJjdXN0b21lciJ9fQ.aGSlEsESVa0c_SckeM8_CnoD1mOUbS9vr-wC44JvGK4.WrWruyKqzREiuyiYqBqBuy; sback_refresh_wp=no; __privaci_cookie_consents={"consents":{"127":1,"129":1,"130":1,"132":1},"location":"MG#BR","lang":"pt-br"}; sback_cart=6170c8c895223dc131061eac; __udf_j=380b17090d67b619a9ee61c0fcea082d8c34530197fe83ba93aeb8a2a8c05797f53786f1cc75ab049c1fe2ce16e4b6b3; isLogged=true; ak_bmsc=205125A5150B33CEC72191D3938FC086~000000000000000000000000000000~YAAQBNlHaF/akp58AQAATurbog3TQK7HvySf4AbiAesDvGTVFv0d7Ofp0nBFrg9LUDjNfQXqwfRtr3+dBm2z6/4fL4zRLr5/EJl/TBPQNzAFQbpJg7RYsIyjZi/oXRZ58VheTDvNuO7bRpM9enR1woExXlBaL/pTNe1u83Guou2uVJpqLC6e/X3g7qX3alFewB7GvxEsWv+uE+ZEzD6ThlTAVZ7/ZE9mYqA30GbrHN6t6dlsfgZ69vdOjWi6gFTPgGTWM9Sswhy4rFOMetfqiFr+Fr/Byh5MjIXcohXkxZOreudHRCs6CZxQFpIIamzmii5SbfXOWOoDNfSQqK0pRnTP9tJ8COTI+ZWh9wRmy6dIuP8Q6+7Kf7HEpCoe8CPr+k+macPip9K3LfFLdg==; bm_sz=5EEA9FF809AE637AC70136071A2C0E77~YAAQBNlHaGDakp58AQAATurbog1oSCBNZzXMz0oKRELKUJdSYq5EvceJXH/J5v8nvB25KGCQbdhztW6OKt2upbzXHrg7MwUXem5PQ+af+M+a4p2qWc7lIhtGznro/bFGp/ReaDhQy4fNdd9eDYDffYWts6Cjk7M9l+E5ZST0od8kELOr/lPa6Rjm016BF9KYGOxgYQve07sWuiy5hpEG8L1vItwt4Bfu+bhTtSi1RFeQQbys9Xr4y4PG6uAFXAkFsP1XPJv3ArNVDw43ljoHLfmjf49nbCX8H1FY/TQcyBEgmVV/~3159108~3683379; chaordic_session=1634819893901-0.4195558392196248; AMCV_F0935E09512D2C270A490D4D%40AdobeOrg=-1124106680%7CMCIDTS%7C18921%7CMCMID%7C17641837100247587343076244177878306586%7CMCAAMLH-1635424694%7C4%7CMCAAMB-1635424694%7CRKhpRz8krg2tLO6pguXWp5olkAcUniQYPHaMWWgdJ3xzPWQmdj0y%7CMCOPTOUT-1634827094s%7CNONE%7CvVersion%7C5.2.0; _st_ses=9624306837682208; _sptid=1592; _spcid=1592; _st_cart_script=helper_nike.js; _st_cart_url=/; _st_id=bmV3LmV5SjBlWEFpT2lKS1YxUWlMQ0poYkdjaU9pSklVekkxTmlKOS5leUpsYldGcGJDSTZJbVJ2WjJSaGNtVmljMEJuYldGcGJDNWpiMjBpZlEubkctX29VdzJJVlZoX1JwREdnR1dneGJBVW4zSmYwMHRBRk93T2hiMVRRdy5XcldydXlLcXpSaVlXckhlaVlIZXpS; sback_customer_w=true; _ce.s=v11slnt~1634822399937; _abck=AEEAD49E7C96598478897A03B3167AA2~0~YAAQJn/NF31nGVV8AQAAChUJowb9NslBqW9WjtAbozZoTSNcYxscC7LQbOhCAZ4x7rnT9wFFM/FYsambEne2NG33IAgXAHmdXxWdWoFooeFE8jo5pTUlGcgHWJpchCtMQpbe069/qySDEsq22u4RSBCEKvwNDm5je+LEo6zQiAGwjkoV/2SMXDwXCnQKqvCiNGFXaJ/vR8XgMezmbt9e5uT7lDD4Iq/iVrDbRBTg3gmD8MQjk7CFUa/r94Mbp5VwDOZz09uqJZhQKSIs9R0UkK87Ft+HMcrCYtjfyB8Tv+PoBhrUygMzJekCZKOiRJeNH6tpDfouDAFmFsYjPASlyoK6Uc8YJPXzfC7UXiLbhv3VQ8klSrsvtnrc37AjvsamZQ9kl7tvMgCXiR1xM+rw2t7BihZl9FIQjGo=~-1~||-1||~-1; lx_sales_channel=%5B%221%22%5D; s_sq=%5B%5BB%5D%5D; _gat_gtag_UA_101374395_1=1; smeventssent_16df2784b41e46129645c2417f131191=true; sback_current_session=1; sback_total_sessions=8; RT="z=1&dm=nike.com.br&si=fa3d03d6-c0a4-4c80-a5d0-c985eb6a8ab8&ss=kv0xjz2f&sl=e&tt=2s7e&bcn=%2F%2F173e252a.akstat.io%2F&obo=2"; gpv_v70=nikecombr%3Ehomepage; pv_templateName=HOME; gptype_v60=homepage; _uetsid=2bd862f031f211eca60b6bd4a9ca18a0; _uetvid=537e67f0fb6b11eb94c87dc474f63058; stc119288=env:1634820182%7C20211121124302%7C20211021141515%7C14%7C1088072:20221021134515|uid:1633786949435.421259805.32019377.119288.139243673.:20221021134515|srchist:1088071%3A1633896133%3A20211110200213%7C1088072%3A1633896150%3A20211110200230%7C1088071%3A1634302097%3A20211115124817%7C1088072%3A1634302111%3A20211115124831%7C1088071%3A1634426035%3A20211116231355%7C1088072%3A1634768005%3A20211120221325%7C1088071%3A1634781320%3A20211121015520%7C1088072%3A1634788732%3A20211121035852%7C1088071%3A1634819894%3A20211121123814%7C1088072%3A1634820182%3A20211121124302:20221021134515|tsa:0:20211021141515; _spl_pv=63; _derived_epik=dj0yJnU9Ump5aXN6WGhhWUVoUUJLeXFWbWprRmphcTZfbGhpTm8mbj1WZWJYZ1RhTDhhaWozOHcyd2ZyY2p3Jm09MSZ0PUFBQUFBR0Z4YnVzJnJtPTEmcnQ9QUFBQUFHRnhidXM; CSRFtoken=aca45fbfc4fe8d29e7424c52bc92a7f2; bm_sv=74223C83455AC9AB62E81CD25145E773~3Zlm/VVdVBmTHglZFISuGSsABhtugH2TiDRp+Ac8yP3YfJYRHyqBVyZR5LAbxVtczWO35BIuwgovCvOCfEgMIDdIYuaEAfpnDT4X9LnCo7V29EFEJjUDUnCBwAROWvGzPyCPvJRpok/bD7KyJ5kKzOUQKW6/1Wg6pSsCmclhyC4='
    //preset product infos

    const getPresetProductInfoFn = async () => await executeOrLog(getProductInfo, { cookie, url: executionParams.preset })
    const presetProductResponse = await infineRetry(getPresetProductInfoFn)
    const presetProductId = await executeOrLog(getProductId, { data: presetProductResponse, tamanho: executionParams.presetNumber })
    const presetCartAddFn = async () => await executeOrLog(cartAdd, { cookie, referer: executionParams.preset, productId: presetProductId })
    const cartAddResponse = await infineRetry(presetCartAddFn)

    //delivery and payment infos
    const getDeliveryInformationFn = async () => await executeOrLog(getDeliveryInformations, { cookie })
    const deliveryInformations = await infineRetry(getDeliveryInformationFn)

    // await browser.close()

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
    const productResponse = await infineRetry(getProductInfoFn, {}, 10000)
    const productId = await executeOrLog(getProductId, { data: productResponse, tamanho: executionParams.productNumber })
    const twoFactorProductId = await executeOrLog(getProductTwoFactorId, { data: productResponse, tamanho: executionParams.productNumber })
    const cartAddFn = async () => await executeOrLog(cartAdd, { cookie, referer: executionParams.product, productId: productId, twoFactorId: twoFactorProductId })
    const productCartAddResponse = await infineRetry(cartAddFn, {}, 10000)
    console.log(productCartAddResponse)

    // bough product

    const buyProductFn = async () => await executeOrLog(buyProduct, { cookie, cardInformations, deliveryInformations })
    const buyResult = await infineRetry(buyProductFn, {}, 5000)
    return
}

bot()