import puppeteer, { HTTPResponse } from 'puppeteer'

const onError = (message: any, page: any = null) => {
    const warning = "###################"
    console.log(warning)
    console.log("FALHA DETECTADA:")
    console.log(message)
    console.log(warning)
}

export const setBrowser = async () => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--disable-notifications', '--start-maximized']
    })
    return browser
}

export const executeLogin = async (browser: puppeteer.Browser, user: string, password: string) => {

    const selectors = {
        goToLoginButton: "#anchor-acessar-unite-oauth2",
        loginEmail: 'input[name=emailAddress]',
        loginPassword: 'input[name=password]',
        loginButton: 'input[value="ENTRAR"]',
        homePage: 'main#home'
    }

    const page = await browser.newPage()
    await page.goto("https://www.nike.com.br")

    //aguardar até encontrar o botão de login e clicar
    await page.waitForSelector(selectors.goToLoginButton)
        .catch(error => onError("Falha ao encontrar botão de login"))
    await page.click(selectors.goToLoginButton)

    /*
    aguardar até encontrar input de email, senha e botão de confirmar.
    depois preencher os campos e clicar no botão
    */
    await page.waitForSelector(selectors.loginEmail)
        .catch(error => { onError("Falha ao encontrar input de emautoail") })
    await page.waitForSelector(selectors.loginPassword)
        .catch(error => onError("Falha ao encontrar input de senha"))
    await page.waitForSelector(selectors.loginButton)
        .catch(error => onError("Falha ao encontrar botão de login"))

    await page.$eval(selectors.loginEmail, (el: any, param: any) => el.value = param, user)
    await page.$eval(selectors.loginPassword, (el: any, param: any) => el.value = param, password)
    await page.click(selectors.loginButton)

    await page.waitForSelector(selectors.homePage)
        .catch(error => { onError("Falha ao redirecionar do login") })

    await page.close()
}

export const initCart = async (browser: puppeteer.Browser, link: string) => {

    const selectors = {
        tamanhoButton: "//li[input[@name='tamanho__id']  and not(contains(@class, 'tamanho-desabilitado'))]//label",
        adicionarCarrinho: 'button#btn-comprar'
    }

    const page = await browser.newPage()
    await page.goto(link)

    await page.waitForXPath(selectors.tamanhoButton)
        .catch(error => onError("Falha ao encontrar botão de tamanho"))
    const [tamanhoButton] = await page.$x(selectors.tamanhoButton)

    await page.waitForSelector(selectors.adicionarCarrinho)
        .catch(error => onError("Falha ao encontrar botão de adicionar ao carrinho"))

    var selected: Boolean | HTTPResponse = false
    while (!selected) {

        tamanhoButton.click()
        await page.click(selectors.adicionarCarrinho)

        const response = await page.waitForResponse(request => {
            return request.url() === "https://www.nike.com.br/Carrinho/Adicionar"
                && response.ok() === true
        }, { timeout: 1000 })
            .catch(error => {
                onError("falha ao aguardar resposta do carrinho")
                return false
            })

        selected = response
    }

    await page.close()

}

export const initPayment = async (browser: puppeteer.Browser, parcelas: number) => {
    const selectors = {
        finalizarCompraButton: '//a[contains(text(), "Finalizar Compra")]',
        seguirPagamento: "//button[@disabled and @id='seguir-pagamento']",
        seguirPagamentoEnabled: "//button[not(@disabled) and @id='seguir-pagamento']",
        modalConfirmarEndereco: "//div[contains(@class, 'modal') and contains(@class, 'ModalCorpoCentralizado')]",
        confirmarEnderecoButton: "div.modal-footer--botao-vertical > button",
        cartoesSalvos: 'div#cartoes-salvos > div',
        cartaoPrincipal: 'div#cartoes-salvos > ul > li > label',
        parcelas: 'select#saved-card-installments',
        aceiteTermos: 'input#politica-trocas',
    }

    const page = await browser.newPage()
    await page.goto("https://www.nike.com.br/checkout")

    //aguardar até encontrar botão de seguir para o pagamento e clicar
    await page.waitForXPath(selectors.seguirPagamentoEnabled)
        .catch(error => onError("Falha ao encontrar botão de seguir para o pagamento habilitado"))
    const [seguirPagamento] = await page.$x(selectors.seguirPagamentoEnabled)
    await seguirPagamento.click()

    /*
    aguardar até abrir modal de confirmar endereço e o botão de confirmar
    aguardar 2s para o script do modal ser carregado e clicar no botão
    */
    await page.waitForXPath(selectors.modalConfirmarEndereco)
        .catch(error => onError("Falha ao encontrar modal de confirmar endereço"))
    await page.waitForSelector(selectors.confirmarEnderecoButton)
        .catch(error => onError("Falha ao encontrar botão para confirmar o endereço"))
    await page.waitForTimeout(2000)
    await page.click(selectors.confirmarEnderecoButton)

    /*
    aguardar 2s para o script de selecionar o cartão seja carregado
    aguardar até encontrar o seletor de cartões e clicar
    */
    await page.waitForTimeout(2000)
    await page.waitForSelector(selectors.cartoesSalvos)
        .catch(error => onError("Falha ao encontrar botão para selecionar cartões"))
    await page.click(selectors.cartoesSalvos)

    /*
    aguardar 2s até preencher o seletor de cartões com 1 cartão
    aguardar até encontrar um cartão no seletor e clicar no cartão
    */
    await page.waitForTimeout(2000)
    await page.waitForSelector(selectors.cartaoPrincipal)
        .catch(error => onError("Falha ao encontrar botão para selecionar um cartão salvo"))
    await page.click(selectors.cartaoPrincipal)

    await page.waitForTimeout(2000)
    await page.waitForSelector(selectors.parcelas)
    await page.select(selectors.parcelas, '1')

    /*
    aguardar 2s para o script de aceitar os termos seja carregado
    aguardar até encontrar o botão de aceite de termos e clicar
    */
    await page.waitForSelector(selectors.aceiteTermos)
        .catch(error => onError("Falha ao encontrar botão de aceite de termos"))
    await page.click(selectors.aceiteTermos)

    return page
}

export const clearCart = async (browser: puppeteer.Browser) => {

    const selectors = {
        removerProduto: '//div[contains(@class, "ckt__produto__botao__remover")]//a[contains(@class, "ckt__produto__remover")]'
    }

    const page = await browser.newPage()
    await page.goto('https://www.nike.com.br/carrinho')

    await page.waitForXPath(selectors.removerProduto)
    const [removerProduto] = await page.$x(selectors.removerProduto)
    await removerProduto.click()
    await page.waitForResponse(request => {
        return request.url() === "https://www.nike.com.br/Carrinho/Excluir"
            && request.ok() === true
    })
    await page.close()

}

export const executeBuy = async (browser: puppeteer.Browser, rota: string, tamanho: string) => {

    const selectors = {
        tamanhoButton: `//li[contains(label,'${tamanho}')]//label`,
        adicionarCarrinho: 'button#btn-comprar'
    }

    const page = await browser.newPage()
    await page.goto(rota)

    //aguardar até encontrar botão de adicionar no carrinho e clicar
    await page.waitForSelector(selectors.adicionarCarrinho)
        .catch(error => onError("Falha ao encontrar botão para adicionar ao carrinho"))
    await page.click(selectors.adicionarCarrinho)

    //aguardar até encontrar botão com o tamanho e clicar
    await page.waitForXPath(selectors.tamanhoButton)
        .catch(error => onError("Falha ao encontrar botão com o tamanho selecionado"))
    const [sizeButton] = await page.$x(selectors.tamanhoButton)

    //aguardar até encontrar botão de adicionar no carrinho e clicar
    await page.waitForSelector(selectors.adicionarCarrinho)
        .catch(error => onError("Falha ao encontrar botão para adicionar ao carrinho"))

    var selected: Boolean | HTTPResponse = false
    while (!selected) {

        sizeButton.click()
        await page.click(selectors.adicionarCarrinho)

        const response = await page.waitForResponse(request => {
            return request.url() === "https://www.nike.com.br/Carrinho/Adicionar"
                && request.ok() === true
        }, { timeout: 1000 })
            .catch(() => false)

        selected = response
    }

    await page.close()
}

export const finishPayment = async (page: puppeteer.Page) => {

    const selectors = {
        confirmarPagamento: 'button#confirmar-pagamento'
    }
    //aguardar até o botão de confirmar pagamento e clicar
    await page.waitForSelector(selectors.confirmarPagamento)
        .catch(error => onError("Falha ao encontrar botão para confimar pagamento e salvar"))
    await page.click(selectors.confirmarPagamento)
}