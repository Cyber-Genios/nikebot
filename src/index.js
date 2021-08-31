const puppeteer = require('puppeteer')
const readlineSync = require('readline-sync');

const variables = {
    // username: 'dogdarebs@gmail.com',
    // password: 'ArthurRARC2',
    // username: 'arthurrangel427@gmail.com',
    // password: 'ArthurRARC1',
    errorFolder: './errors/',
    errorCount: 0,
    username: 'vitin_36@hotmail.com',
    password: 'Vitor102030',
    date: '2021-08-31 10:00:00',
    presetDate: '2021-08-31 09:52:30',
    preset: 'https://www.nike.com.br/tenis-nike-air-vapormax-2021-flyknit-masculino-153-169-223-324914',
    product: 'https://www.nike.com.br/nike-zoomx-vaporfly-next-x-gyakusou-263-508-511-221968',
    // product: 'https://www.nike.com.br/nike-zoomx-vaporfly-next-x-gyakusou-263-508-511-221971',
    phoneNumber: '34992291965',
    login: {
        loginPage: 'https://www.nike.com.br',
        loginPageButton: "#anchor-acessar-unite-oauth2",
        loginEmail: 'input[name=emailAddress]',
        loginPassword: 'input[name=password]',
        loginButton: 'input[value="ENTRAR"]',
        homePage: 'main#home'
    },
    productPreset: {
        tamanhoButton: "//li[input[@name='tamanho__id']  and not(contains(@class, 'tamanho-desabilitado'))]//label",
        adicionarCarrinho: 'button#btn-comprar'
    },
    cartPreset: {
        cartPage: 'https://www.nike.com.br/checkout',
        finalizarCompraButton: '//a[contains(text(), "Finalizar Compra")]',
        seguirPagamento: "//button[@disabled and @id='seguir-pagamento']",
        seguirPagamentoEnabled: "//button[not(@disabled) and @id='seguir-pagamento']",
        modalConfirmarEndereco: "//div[contains(@class, 'modal') and contains(@class, 'ModalCorpoCentralizado')]",
        confirmarEnderecoButton: "div.modal-footer--botao-vertical > button",
        cartoesSalvos: 'div#cartoes-salvos > div',
        cartaoPrincipal: 'div#cartoes-salvos > ul > li > label',
        parcelas: 'select#saved-card-installments',
        aceiteTermos: 'input#politica-trocas',
    },
    clearCart: {
        cartPage: 'https://www.nike.com.br/carrinho',
        removerProduto: '//div[contains(@class, "ckt__produto__botao__remover")]//a[contains(@class, "ckt__produto__remover")]'
    },
    productSelect: {
        tamanhoButton: `//li[contains(., "40")]/label`,
        adicionarCarrinho: 'button#btn-comprar',
        foneInput: 'input.phone-number',
        enviarCodigoButton: '//div[contains(button,"Enviar código")]//button',
        modalTwoFactor: '//form[contains(p, "INSIRA O CÓDIGO")]',
        auth1: 'input[name="Code1"]',
        auth2: 'input[name="Code2"]',
        auth3: 'input[name="Code3"]',
        auth4: 'input[name="Code4"]',
        auth5: 'input[name="Code5"]',
        auth6: 'input[name="Code6"]',
        confirmarCodigoButton: '//div[contains(button, "Confirmar")]//button',
        reenviarCodigo: 'button.btn-resend'
    },
    cartFinish: {
        confirmarPagamento: 'button#confirmar-pagamento'
    }
}

const treatError = async (error, page) => {
    console.log(error)
    await page.screenshot(`${variables.errorFolder}error-${variables.errorCount}.png`)
    variables.errorCount += 1
    throw Error()
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
    await new Promise((resolve, reject) => setTimeout(function () {
        console.log(`executando ${executionType}`)
        clearInterval(interval)
        resolve()
    }, dateToExecute.timeTo))
    return
}

const alwaysRetry = async (func, param) => {
    let success = false
    console.log('trying to executing func ', func)
    while (!success) {
        console.log('executing func ', func)
        try {
            const result = await func(param)
            success = true
            return result
        }
        catch {
            success = false
        }
    }
}

const exec = async () => {
    let browser
    try {
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-notifications', '--start-maximized']
        })
    } catch (error) {
        console.log('erro ao instanciar browser e pagina')
        console.log(error)
        return
    }

    await schedule(variables.presetDate, 'preset')
    await alwaysRetry(login, browser)
    await alwaysRetry(productPreset, browser)
    const cartPage = await alwaysRetry(cartPreset, browser)
    await alwaysRetry(clearCart, browser)
    await schedule(variables.date, 'execution')
    await alwaysRetry(productSelect, browser)
    console.log('finalizando carrinho')
    await alwaysRetry(cartFinish, cartPage)
    await browser.close()
    return
}

const login = async (browser) => {
    const page = await browser.newPage()

    try {
        await page.goto(variables.login.loginPage)
        await page.waitForSelector(variables.login.loginPageButton, { timeout: 10000 })
        await page.click(variables.login.loginPageButton)

        await page.waitForSelector(variables.login.loginEmail, { timeout: 10000 })
        await page.waitForSelector(variables.login.loginPassword, { timeout: 10000 })
        await page.waitForSelector(variables.login.loginButton, { timeout: 10000 })

        await page.$eval(variables.login.loginEmail, (el, param) => el.value = param, variables.username)
        await page.$eval(variables.login.loginPassword, (el, param) => el.value = param, variables.password)
        await page.click(variables.login.loginButton)

        await page.waitForResponse(response => {
            return response.url().includes('/login') && response.ok() ? true : false
        }, { timeout: 5000 })

        await page.waitForSelector(variables.login.homePage, { timeout: 10000 })
    }
    catch (e) {
        await treatError(e, page)
    }
    finally {
        await page.close()
    }
}

const productPreset = async (browser) => {
    const page = await browser.newPage()

    try {
        await page.goto(variables.preset)
        await page.waitForXPath(variables.productPreset.tamanhoButton)
        const [tamanhoButton] = await page.$x(variables.productPreset.tamanhoButton)
        await page.waitForSelector(variables.productPreset.adicionarCarrinho)

        await alwaysRetry(async () => {
            await tamanhoButton.click()
            await page.click(variables.productPreset.adicionarCarrinho)
            await page.waitForResponse(response => {
                return response.url().includes('/Carrinho/Adicionar') && response.ok() ? true : false
            })
        })

    }
    catch (e) {
        await treatError(e, page)
    }
    finally {
        await page.close()
    }
}

const cartPreset = async (browser) => {
    const page = await browser.newPage()
    try {
        await page.goto(variables.cartPreset.cartPage)
        await page.waitForXPath(variables.cartPreset.seguirPagamentoEnabled)
        const [seguirPagamento] = await page.$x(variables.cartPreset.seguirPagamentoEnabled)
        await seguirPagamento.click()

        await page.waitForXPath(variables.cartPreset.modalConfirmarEndereco)
        await page.waitForSelector(variables.cartPreset.confirmarEnderecoButton)
        await page.waitForTimeout(2000)
        await page.click(variables.cartPreset.confirmarEnderecoButton)

        await page.waitForTimeout(2000)
        await page.waitForSelector(variables.cartPreset.cartoesSalvos)
        await page.click(variables.cartPreset.cartoesSalvos)

        await page.waitForTimeout(2000)
        await page.waitForSelector(variables.cartPreset.cartaoPrincipal)
        await page.click(variables.cartPreset.cartaoPrincipal)

        await page.waitForTimeout(2000)
        await page.waitForSelector(variables.cartPreset.parcelas)
        await page.select(variables.cartPreset.parcelas, '1')

        await page.waitForSelector(variables.cartPreset.aceiteTermos)
        await page.click(variables.cartPreset.aceiteTermos)

    }
    catch {
        await page.screenshot(`${variables.errorFolder}error-${variables.errorCount}.png`)
        variables.errorCount += 1
        page.close()
        throw Error('Erro ao setar carrinho')
    }

    return page
}

const clearCart = async (browser) => {
    const page = await browser.newPage()

    try {
        await page.goto(variables.clearCart.cartPage)

        await page.waitForXPath(variables.clearCart.removerProduto)
        const [removerProduto] = await page.$x(variables.clearCart.removerProduto)
        await removerProduto.click()
        await page.waitForResponse(request => {
            return request.url().includes("/Carrinho/Excluir") && request.ok() ? true : false
        })
    }
    catch (e) {
        await treatError(e, page)
    }
    finally {
        page.close()
    }
}

const productSelect = async (browser) => {
    const page = await browser.newPage()

    let response
    await alwaysRetry(async () => {
        await page.goto(variables.product)
        await page.waitForSelector(variables.productSelect.adicionarCarrinho, { timeout: 5000, visible: true, })
        await page.waitForXPath(variables.productSelect.tamanhoButton, { timeout: 5000, visible: true, })
        const [sizeButton] = await page.$x(variables.productSelect.tamanhoButton)
        await sizeButton.click()
        await page.click(variables.productSelect.adicionarCarrinho)
        const messageResponse = await page.waitForResponse(response => {
            return response.url().includes('/Carrinho/Adicionar') && response.ok() ? true : false
        }, { timeout: 5000 })
        response = await messageResponse.json()
        if (!response.success && !response.twoFactorAuth) {
            throw Error()
        }
    })
    if (!response.success && response.twoFactorAuth) {
        await alwaysRetry(async () => {
            await page.waitForSelector(variables.productSelect.foneInput, { timeout: 10000 })
            await page.$eval(variables.productSelect.foneInput, (el, param) => el.value = param, variables.phoneNumber)
            await page.waitForXPath(variables.productSelect.enviarCodigoButton, { visible: true, timeout: 10000 })
            const [enviarCodigoButton] = await page.$x(variables.productSelect.enviarCodigoButton)
            await enviarCodigoButton.click()
            await page.waitForResponse(response => {
                return response.url().includes("/auth/two-factor/generate") && response.ok() ? true : false
            }, { timeout: 10000 })
            await page.waitForXPath(variables.productSelect.modalTwoFactor, { timeout: 5000 })
            await page.waitForSelector(variables.productSelect.auth1, { timeout: 5000 })
            await page.waitForSelector(variables.productSelect.auth2, { timeout: 5000 })
            await page.waitForSelector(variables.productSelect.auth3, { timeout: 5000 })
            await page.waitForSelector(variables.productSelect.auth4, { timeout: 5000 })
            await page.waitForSelector(variables.productSelect.auth5, { timeout: 5000 })
            await page.waitForSelector(variables.productSelect.auth6, { timeout: 5000 })
        })
        await alwaysRetry(async () => {
            const code = await readlineSync.question("Codigo de autenticação: \n", {
                limit: (input) => input.length === 6,
                limitMessage: 'Codigo de autenticação deve ter 6 caracteres'
            })
            await page.$eval(variables.productSelect.auth1, (el, param) => el.value = param, code[0])
            await page.$eval(variables.productSelect.auth2, (el, param) => el.value = param, code[1])
            await page.$eval(variables.productSelect.auth3, (el, param) => el.value = param, code[2])
            await page.$eval(variables.productSelect.auth4, (el, param) => el.value = param, code[3])
            await page.$eval(variables.productSelect.auth5, (el, param) => el.value = param, code[4])
            await page.$eval(variables.productSelect.auth6, (el, param) => el.value = param, code[5])
            await page.waitForXPath(variables.productSelect.confirmarCodigoButton)
            const [confirmarCodigoButton] = await page.$x(variables.productSelect.confirmarCodigoButton)
            await confirmarCodigoButton.click()
            const response = await page.waitForResponse(response => {
                return response.url().includes('/validate')
            }, { timeout: 10000 })
            let responseBody = await response.json()
            let responseCode = await response.ok()
            if (!responseCode || !responseBody.valid) {
                console.log('entrei no cenário ruim', responseCode, responseBody.valid, responseCode || !responseBody.valid)
                await page.waitForSelector(variables.productSelect.reenviarCodigo, { visible: true, timeout: 5000 })
                await page.click(variables.productSelect.reenviarCodigo)
                throw Error('Erro ao validar codigo de autenticação')
            }
        })
    }
    await page.close()
    return
}

const cartFinish = async (page) => {
    await page.waitForSelector(variables.cartFinish.confirmarPagamento)
    await page.click(variables.cartFinish.confirmarPagamento)
    await page.waitForTimeout(20000)
}

exec()