const axios = require('axios').default
const readlineSync = require('readline-sync')

const executionParams = {
    date: '2021-11-06 10:00:00',
    presetDate: '2021-11-06 09:30:00',
    preset: 'https://www.nike.com.br/tenis-nike-pegasus-trail-3-masculino-153-169-224-324706?gridPosition=G1',
    product: 'https://www.nike.com.br/nike-dunk-low-retro-153-169-211-303045',
    presetNumber: 38,
    productNumber: 41,
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

    const cookie = 'name=value; name=value; nikega=GA1.4.439398858.1633786578; _ga=GA1.3.439398858.1633786578; s_cc=true; __pr.cvh=vqnlvq3jr6; SIZEBAY_SESSION_ID_V4=1643A8ECAD39fd34398a8727414b8dbd7070f1b8331e; _gcl_au=1.1.1205611723.1633786580; user_unic_ac_id=8c322c28-2d50-68bb-1570-292c2acb14c9; advcake_trackid=da96c412-011a-d58c-0e20-587d4bcc474e; _fbp=fb.2.1633786626324.807380073; sb_days=1633786627964; smeventsclear_16df2784b41e46129645c2417f131191=true; AMCVS_F0935E09512D2C270A490D4D%40AdobeOrg=1; chaordic_browserId=0-wDHuHy0431YKd4aWk1TGs3IvqI4TngZzWE1_16337869484713722; chaordic_anonymousUserId=anon-0-wDHuHy0431YKd4aWk1TGs3IvqI4TngZzWE1_16337869484713722; blueID=dcfc3510-f641-43ab-9594-9e4b66a89880; _pin_unauth=dWlkPU5HSTFOR0ZrWkRBdE9EVmhPUzAwTkdRNExXRXhZV1l0T0RjMVpHRTFOMll4TTJNMA; __privaci_cookie_consent_uuid=e3109125-3321-4ddc-b10a-79c30dc1e98f:2; __privaci_cookie_consent_generated=e3109125-3321-4ddc-b10a-79c30dc1e98f:2; sback_client=5816989a58791059954e4c52; sback_partner=false; __privaci_cookie_consents={"consents":{"127":1,"129":1,"130":1,"132":1},"location":"MG#BR","lang":"pt-br"}; _ce.s=v11slnt~1634825548867; __udf_j=924fd09e5be62b19aad5c0db6f85108658f56a2fcd4b73c938ce013dbcd56dd0a2166004db903193949126e853b6cd48; isLogged=false; bm_sz=6C91708B6FB05F8981DB3177DCB89313~YAAQp5SuyCcXAe18AQAACbg49Q3DxFNG8Q4+u0JRhsSCAj9Ki73Q6RQNEBys7QlUVtik02dTcuAyCtJxbW3HmhCri81FdKcadsFuV3Mo65QIULb21x6YvY75k5GvlsR5EM6NDT9Rhc6OksqeAHs+EWMK6snDVXkkL/N1mBwQ/sR0qVCG46kEL2Y5VDPZBWPiIjMsvYdO0LfroR/pS+DnI6fixjtEDE5S2IDHylRxFQuHnM34Mnl+/bFADSOFqa3R+0FEToTpLIqTzvXn7/knuchsE1qULa2A7SiNtmoqD0wZvrZq~3360068~4473395; IFCSHOPSESSID=0bfr3fd6jm494blel74s5udrha; _gid=GA1.3.571378018.1636201708; nikega_gid=GA1.4.371542461.1636201708; chaordic_session=1636201708425-0.9277101067079674; AMCV_F0935E09512D2C270A490D4D%40AdobeOrg=-1124106680%7CMCIDTS%7C18938%7CMCMID%7C17641837100247587343076244177878306586%7CMCAAMLH-1636806508%7C4%7CMCAAMB-1636806508%7CRKhpRz8krg2tLO6pguXWp5olkAcUniQYPHaMWWgdJ3xzPWQmdj0y%7CMCOPTOUT-1636208908s%7CNONE%7CvVersion%7C5.2.0; Campanha=; Midia=; chaordic_testGroup=%7B%22experiment%22%3Anull%2C%22group%22%3Anull%2C%22testCode%22%3Anull%2C%22code%22%3Anull%2C%22session%22%3Anull%7D; _st_ses=2977113835627454; _sptid=1592; _spcid=1592; _st_cart_script=helper_nike.js; _st_cart_url=/; _st_id=bmV3LmV5SjBlWEFpT2lKS1YxUWlMQ0poYkdjaU9pSklVekkxTmlKOS5leUpsYldGcGJDSTZJbVJ2WjJSaGNtVmljMEJuYldGcGJDNWpiMjBpZlEuMHE3amFwOWJ5Q29ueWctSG5yNjRQdjJCemtEU1FZcE1oRTF4aUZ0b1FwRS5XcldydXlLcXV5Z1BxQldyRWlXcnFC; _cm_ads_activation_retry=false; sback_browser=0-98989300-163620171008c2d6d7a1c60ef4147dbcc45b1e16393371101f1333024606618674eef1ad46-74568243-18912312486,13017640162-1636201710; sback_customer=$2gYy4URupmYOpmeyF1VqZlT3sWckVHV0llTxEVVURVePF2amZlVUBjT1FTcNV0Rv9kN6NWS2RlMapEao5UcqJkW2$12; sback_access_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGkuc2JhY2sudGVjaCIsImlhdCI6MTYzNjIwMTcxMiwiZXhwIjoxNjM2Mjg4MTEyLCJhcGkiOiJ2MiIsImRhdGEiOnsiY2xpZW50X2lkIjoiNTgxNjk4OWE1ODc5MTA1OTk1NGU0YzUyIiwiY2xpZW50X2RvbWFpbiI6Im5pa2UuY29tLmJyIiwiY3VzdG9tZXJfaWQiOiI2MTYzNDZkN2E1NTlkNTU1YzgzMmVhM2YiLCJjdXN0b21lcl9hbm9ueW1vdXMiOnRydWUsImNvbm5lY3Rpb25faWQiOiI2MTYzNDZkN2E1NTlkNTU1YzgzMmVhNDAiLCJhY2Nlc3NfbGV2ZWwiOiJjdXN0b21lciJ9fQ.U7pny7GA9gCHydnkuIsOT0P6zhyExY6Jq7pn-seQNR8.WrWruyKquygPqBWrEiWrgP; sback_current_session=1; sback_total_sessions=16; sback_customer_w=true; sback_refresh_wp=no; isLogged=1; _gat_nikelaunchga=1; _gat_gtag_UA_142883149_1=1; s_sq=%5B%5BB%5D%5D; _gat_gtag_UA_101374395_1=1; CSRFtoken=38842e48ff9bb2ffedfd7243f54c908f; _abck=AEEAD49E7C96598478897A03B3167AA2~0~YAAQnpSuyIWZQeh8AQAAlMk79QYs0AAIuf2yKYfDu6aaPku9InL+vR2poWgQpZcHpV6x83QE1SPCvqoayHb0TqPYzzb2OvitnH+BF6DqMNcaJ2m7qmRJt4KIGoUa528jyXsHbfedaq28vrKnzaBjIOUhY94ADadVMx2VbR1/MRki6NcQfP5irL5BB6P9mtn6Ik3THsAcI8x1NzyPu/tuTfwh7HzYN+0MFfdGw/96RAWKoZQx024DfWzrllUD8hlovRMIorX7dX20dWq9CXzty6aSZRdjTJ7nRUQOBFKGAuF1SvwqSoVtjkvCPKf7E3MMO/ZWtydHXxlXHfYM33CFyOHXp7SPGS6KI2QC7+sF8aMBN4a3Axe72PJf1NWUNW3XZttYD3k2ZzKCGD7O7NW0xjmAkby2Fg==~-1~-1~-1; _uetsid=0cb23cc03efd11ecb7ea27530df28f4d; _uetvid=537e67f0fb6b11eb94c87dc474f63058; stc119288=env:1636201908%7C20211207123148%7C20211106130148%7C1%7C1088072:20221106123148|uid:1633786949435.421259805.32019377.119288.139243673.:20221106123148|srchist:1088071%3A1634781320%3A20211121015520%7C1088072%3A1634788732%3A20211121035852%7C1088071%3A1634819894%3A20211121123814%7C1088072%3A1635030087%3A20211123230127%7C1088071%3A1635250503%3A20211126121503%7C1088072%3A1635419757%3A20211128111557%7C1088071%3A1635424074%3A20211128122754%7C1088072%3A1635424482%3A20211128123442%7C1088071%3A1636201710%3A20211207122830%7C1088072%3A1636201908%3A20211207123148:20221106123148|tsa:0:20211106130148; _spl_pv=174; _derived_epik=dj0yJnU9aTduZDdrcVRKRHlnT2JvdkhQaFBuTUlEbHVSTVkwemEmbj0yNTl4UkpFR1ZObVJwWUpjdk9FNDlRJm09MSZ0PUFBQUFBR0dHZGJRJnJtPTEmcnQ9QUFBQUFHR0dkYlE; smeventssent_16df2784b41e46129645c2417f131191=true; gpv_v70=nikecombr%3Epdp%3Enike%20dunk%20low%20retro; pv_templateName=PDP; gptype_v60=PDP; bm_sv=959F034304DBC2102D8D625A4543AAA4~kp8HH24uPXIKu47/lVBJg2D21xrWQfTt8jXpcR2+sdB5miWUU8TeuOCukd/kFpRwHj6p5wAU5+quixLCnqcPXAtVBJaiuDyH0cgqbk2y7e7hPHnEmLr5oVg3LpiqSTZnx2MqlGRawzefA5tIslEc5A9XIbYKxfOo8lQbUL/f8IQ=; ak_bmsc=A46DE589054A23B33E355E6362D01061~000000000000000000000000000000~YAAQnpSuyL6hQeh8AQAAV3w89Q0/Sf1UmuFxL4BcmsQTLVOTTchdMDB8WJ9ZSdiWsSKhTzSF7vS1sJpV/vnAjf8ujey9SPGatR113i9bvkIZdG61LpZph6T0aO3QOPcyYkwwsByU7t7Xms+kXuehGJuxQc1Gzaq75+ZtRsaO1I+HKmZBtFLmx4CQc3sUboD9FhP9NUzudN1CH4I94Y7t545ZwJkaEEa6NTII37tYgKb8itErpEFrVgH0075lNaFnfeCHcA/PVI98ehr0PL4b/KbHNrV0bKnv8r3PDzeSR7Y7HY/tbD6tGUJy1b6MxlfMJe2fpc2HVJjzBRPI0bQXNrGBiqecSzKfBDJWUxmUUVnoonP3WgV9ozfVicTdrfCPEwWvshgzpi/PM7Eas0nfDgriD4oar4N9vfPE5nUBXniKD3A349ZCHaXjdiMF2/511b956A==; lx_sales_channel=%5B%221%22%5D; RT="z=1&dm=nike.com.br&si=eac7ce48-cab6-4567-9b51-e21e5ab9ae0b&ss=kvns91eq&sl=2&tt=4rx&bcn=%2F%2F173e2508.akstat.io%2F"'
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