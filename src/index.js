const axios = require("axios").default;
const readlineSync = require("readline-sync");
const executionParams = require("./execucao").executionParams;
const cli = require("cli-color");
const fs = require("fs");
const fsExtra = require("fs-extra");

const error = cli.red.bold;
const info = cli.blue.bold;
const warn = cli.yellow.bold;
const success = cli.green.bold;

const createOrAppend = async (obj) => {
  const fileName = `${executionParams.email}.txt`;
  const fileExists = fsExtra.ensureFileSync(fileName);

  if (!fileExists) {
    fsExtra.writeFileSync(fileName);
  }

  fs.appendFileSync(fileName, "===================");
  fs.appendFileSync(fileName, obj);
};

const timeTo = (date) => {
  const now = new Date();
  const nextTime = new Date(date);
  const timeTo = nextTime.getTime() - now.getTime();
  return {
    timeTo,
    times: {
      hours: Math.floor(timeTo / 1000 / 3600),
      minutes: Math.floor(((timeTo / 1000) % 3600) / 60),
      seconds: Math.floor(((timeTo / 1000) % 3600) % 60),
    },
  };
};

const schedule = async (date, executionType) => {
  const dateToExecute = timeTo(date);
  console.log(info(`${executionType} em :`));
  const interval = setInterval(function () {
    const response = timeTo(date);
    console.log(
      `${response.times.hours} hora(s), ${response.times.minutes} minuto(s) e ${response.times.seconds} segundo(s)`
    );
  }, 1000);
  await new Promise((resolve, reject) =>
    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, dateToExecute.timeTo)
  );
  return;
};

const infineRetry = async (func, params = {}, timeoutRetry = 0, funcName) => {
  let success = false;
  console.log(info("Executando:", funcName));
  while (!success) {
    try {
      return await func(params);
    } catch (e) {
      createOrAppend(e);
      success = false;
      timeoutRetry
        ? await schedule(
            new Date(new Date().getTime() + timeoutRetry),
            funcName
          )
        : null;
    }
  }
};

const executeOrLog = async (func, params, _finnaly, funcName) => {
  try {
    return await func(params);
  } catch (e) {
    console.log(error("Erro ao executar função:"), warn(funcName));
    throw Error();
  } finally {
    _finnaly ? await _finnaly() : undefined;
  }
};

const getDeliveryInformations = async ({ cookie }) => {
  const headers = {
    cookie,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    origin: "https://www.nike.com.br",
  };
  const { data } = await axios({
    method: "post",
    url: "https://www.nike.com.br/checkout",
    headers,
    timeout: 60000,
  });
  const inputCepRegex = `<input type="hidden" id="calcularFreteCallback"(.*?)>`;
  const valorCepRegex = `value="(.*?)"`;
  const [inputCepRegexResult] = data.match(inputCepRegex);
  const [ignore, deliveryAddress] = inputCepRegexResult.match(valorCepRegex);

  const inputAddressIdRegex = `<input type="hidden" id="user-shipping-address-id"(.*?)>`;
  const valorAddressIdRegex = `value="(.*?)"`;
  const [inputAddressIdRegexResult] = data.match(inputAddressIdRegex);
  const [ignoreToo, deliveryId] =
    inputAddressIdRegexResult.match(valorAddressIdRegex);

  if (!data || !deliveryAddress || !deliveryId) throw Error();

  return {
    id: deliveryId,
    address: deliveryAddress,
  };
};

const getProductInfo = async ({ cookie, url }) => {
  const headers = {
    cookie,
    referer: url,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    origin: "https://www.nike.com.br",
  };
  const { data } = await axios({
    method: "post",
    url: "https://www.nike.com.br/Requisicao/Ajax",
    headers,
    timeout: 60000,
  });
  if (!data || !data.Carrinho_Resumo) throw Error();
  return data;
};

const cartAdd = async ({ cookie, productId, referer, twoFactorId }) => {
  const headers = {
    cookie,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    origin: "https://www.nike.com.br",
    referer,
  };
  const dataRequest = `EPrincipal=${productId}&EAcessorio%5B%5D=&ECompreJunto%5B%5D=&AdicaoProdutoId=&Origem=&SiteId=106&g-recaptcha-response=`;
  const { data } = await axios({
    method: "post",
    url: "https://www.nike.com.br/Carrinho/Adicionar",
    data: dataRequest,
    headers,
    timeout: 60000,
  });

  if (!data.success && data.twoFactorAuth) {
    const twoFactor = async () =>
      await executeOrLog(
        twoFactorGenerate,
        {
          cookie,
          referer,
          productId: twoFactorId,
        },
        null,
        "Gerar código de autenticação dupla"
      );
    await infineRetry(
      twoFactor,
      null,
      5000,
      "Gerar código de autenticação dupla"
    );
    const code = readlineSync.question("Codigo de autenticação: \n", {
      limit: (input) => input.length === 6,
      limitMessage: "Codigo de autenticação deve ter 6 caracteres",
    });

    const twoFactorConfirm = await executeOrLog(
      twoFactorConfirm,
      {
        cookie,
        referer,
        productId: twoFactorId,
        code,
      },
      null,
      "Confirmar Código de autenticação"
    );

    await infineRetry(
      twoFactor,
      null,
      5000,
      "Confirmar Código de autenticação"
    );
  }

  if (!data) {
    throw Error();
  }

  return data;
};
const twoFactorGenerate = async ({ cookie, referer, productId }) => {
  const headers = {
    cookie,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    origin: "https://www.nike.com.br",
    referer,
  };
  const dataRequest = `CelularCliente=${executionParams.phoneNumber}&ProdutoId=${productId}`;
  const { data } = await axios({
    method: "post",
    url: "https://www.nike.com.br/auth/two-factor/generate",
    headers,
    data: dataRequest,
    timeout: 60000,
  });

  if (!data || !data.valid) {
    throw Error();
  }

  return;
};

const twoFactorConfirm = async ({ cookie, referer, productId, code }) => {
  const headers = {
    cookie,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    origin: "https://www.nike.com.br",
    referer,
  };
  const dataRequest = `NumberCode=${code}&ProdutoId=${productId}`;
  const { data } = await axios({
    method: "post",
    url: "https://www.nike.com.br/auth/two-factor/validate",
    headers,
    data: dataRequest,
    timeout: 60000,
  });

  if (!data || !data.valid) {
    throw Error();
  }

  return;
};

const calculateDelivery = async ({ cookie, cep }) => {
  const headers = {
    cookie,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    origin: "https://www.nike.com.br",
  };
  const { data } = await axios({
    method: "post",
    url: "https://www.nike.com.br/Frete/CalcularFretePromocao",
    headers,
    data: `cep=${cep}`,
  });
  if (!data || !data.success) throw Error();
  const [frete] = data.frete;
  return frete.TipoEntrega;
};

const selectDelivery = async ({ cookie, deliveryType }) => {
  const headers = {
    cookie,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    origin: "https://www.nike.com.br",
  };
  const dataRequest = `hash=&tipoEntrega=${deliveryType}`;
  const response = await axios({
    method: "post",
    url: "https://www.nike.com.br/Frete/EscolheFreteCarrinho",
    data: dataRequest,
    headers,
    timeout: 60000,
  });
  const { data } = response;
  if (!data || !data.success) {
    throw Error();
  }
  return data;
};

const findCarts = async ({ cookie }) => {
  const headers = {
    cookie,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    origin: "https://www.nike.com.br",
  };
  const requestResponse = await axios({
    method: "post",
    url: "https://www.nike.com.br/Checkout/VerificaCartoesSalvos",
    headers,
    timeout: 60000,
  });
  const { data } = requestResponse;
  if (!data || !data.success) {
    throw Error();
  }
  const [firstCard] = data.dados;
  const response = {
    brand: firstCard.Bandeira,
    id: firstCard.CartaoCreditoId,
    lastDigits: firstCard.UltimosDigitos,
  };
  return response;
};

const buyProduct = async ({
  cookie,
  cardInformations,
  deliveryInformations,
}) => {
  const headers = {
    cookie,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    origin: "https://www.nike.com.br",
    referer: "https://www.nike.com.br/checkout",
  };
  const dataRequest = `MeioPagamentoId=1&ClearsaleFingerprint=&TipoVale=&SalvarCartao=0&CartaoCreditoId=${cardInformations.id}&UltimosDigitos=${cardInformations.lastDigits}&EnderecoId=${deliveryInformations.id}&Utm%5BUtmSource%5D=Direct&Utm%5BUtmMedium%5D=&Utm%5BUtmTerm%5D=&Utm%5BUtmCp%5D=&Utm%5BUtmContent%5D=&Utm%5BUtmCampaign%5D=&Bandeira=${cardInformations.brand}&Bandeira_2=&Nome=&Nome_2=&NumCartao1=&NumCartao1_2=&ValidadeMesAno=%2F&ValidadeMesAno2=null%2Fnull&CodSeguranca=&CodSeguranca_2=&Parcelamento=1&Parcelamento_2=&DocumentoPortador=&DocumentoPortador2=&DoisCartoes=0&ValorCartao_1=&ValorCartao_2=&ShippingType=Normal`;
  const response = await axios({
    method: "post",
    url: "https://www.nike.com.br/Pagamento/gravarPedido",
    headers,
    data: dataRequest,
    timeout: 60000,
  });
  const { data } = response;
  if (!data || !data.success) {
    throw Error();
  }
  return data;
};

const clearCart = async ({ cookie, productId }) => {
  const headers = {
    cookie,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    origin: "https://www.nike.com.br",
  };
  const dataRequest = `Codigo=${productId}&SiteId=106&customid=`;
  const response = await axios({
    method: "post",
    url: "https://www.nike.com.br/Carrinho/Excluir",
    headers,
    data: dataRequest,
    timeout: 60000,
  });
  const { data } = response;
  if (!data || !data.success) {
    throw Error();
  }
  return data;
};

const getProductId = async ({ data, tamanho }) => {
  const productDetails = JSON.parse(data.DetalheProduto).variacoesProduto;
  const inputRegex = `<input type="radio" class="tamanho__item_pdp js-tamanho__item_pdp" data-tamanho="${tamanho}"(.*?)(.*?)>`;
  const codigoProdutoRegex = `data-codigoproduto="(.*?)"`;
  const [inputRegexResult] = productDetails.match(inputRegex);
  const [codigoProdutoRegexResult, codigoProduto] =
    inputRegexResult.match(codigoProdutoRegex);
  return codigoProduto;
};

const getProductTwoFactorId = async ({ data, tamanho }) => {
  const productDetails = JSON.parse(data.DetalheProduto).variacoesProduto;
  const inputRegex = `<input type="radio" class="tamanho__item_pdp js-tamanho__item_pdp" data-tamanho="${tamanho}"(.*?)(.*?)>`;
  const linkProdutoRegex = `value="(.*?)"`;
  const [inputRegexResult] = productDetails.match(inputRegex);
  const [codigoProdutoRegexResult, value] =
    inputRegexResult.match(linkProdutoRegex);
  const productId = value.split("-").pop();
  return productId;
};

const bot = async () => {
  //login and cookies
  await schedule(executionParams.presetDate, "Preset");

  const cookie = executionParams.cookie;

  //buscar produto de preset
  const presetProductId = await infineRetry(
    async () => {
      const getPresetProductInfoFn = async () =>
        await executeOrLog(
          getProductInfo,
          { cookie, url: executionParams.preset },
          null,
          "Busca do produto de preset"
        );

      const presetProductResponse = await infineRetry(
        getPresetProductInfoFn,
        null,
        0,
        "Busca do produto de preset"
      );

      return await executeOrLog(
        getProductId,
        {
          data: presetProductResponse,
          tamanho: executionParams.presetNumber,
        },
        null,
        "Busca do id do produto de preset"
      );
    },
    null,
    0,
    "Busca do produto de preset e id"
  );

  const presetCartAddFn = async () =>
    await executeOrLog(
      cartAdd,
      {
        cookie,
        referer: executionParams.preset,
        productId: presetProductId,
      },
      null,
      "Adicionar produto de preset no carrinho"
    );

  const cartAddResponse = await infineRetry(
    presetCartAddFn,
    null,
    10000,
    "Adicionar produto de preset no carrinho"
  );

  //delivery and payment infos
  const getDeliveryInformationFn = async () =>
    await executeOrLog(
      getDeliveryInformations,
      { cookie },
      null,
      "Busca de informações de entrega"
    );
  const deliveryInformations = await infineRetry(
    getDeliveryInformationFn,
    null,
    0,
    "Busca de informações de entrega"
  );

  const calculateDeliveryFn = async () =>
    await executeOrLog(
      calculateDelivery,
      {
        cookie,
        cep: deliveryInformations.address,
      },
      null,
      "Buscar informações de endereço"
    );

  const calculateDeliveryResponse = await infineRetry(
    calculateDeliveryFn,
    null,
    0,
    "Buscar informações de endereço"
  );

  const selectDeliveryFn = async () =>
    await executeOrLog(
      selectDelivery,
      {
        cookie,
        deliveryType: calculateDeliveryResponse,
      },
      null,
      "Selecionar endereço de entrega"
    );
  const selectDeliveryResponse = await infineRetry(
    selectDeliveryFn,
    null,
    0,
    "Selecionar endereço de entrega"
  );

  const findCartsFn = async () =>
    await executeOrLog(
      findCarts,
      { cookie },
      null,
      "Buscar produtos no carrinho"
    );

  const cardInformations = await infineRetry(
    findCartsFn,
    null,
    0,
    "Buscar produtos no carrinho"
  );

  //clear cart after preset
  const clearCartFn = async () =>
    executeOrLog(
      clearCart,
      { cookie, productId: presetProductId },
      null,
      "Limpar carrinho"
    );

  const clearCartResponse = await infineRetry(
    clearCartFn,
    null,
    0,
    "Limpar carrinho"
  );

  //product infos
  await schedule(executionParams.date, "Compra do produto");

  const { productId, twoFactorProductId } = await infineRetry(
    async () => {
      const getProductInfoFn = async () =>
        await executeOrLog(
          getProductInfo,
          {
            cookie,
            url: executionParams.product,
          },
          null,
          "Buscar informações do produto"
        );

      const productResponse = await infineRetry(
        getProductInfoFn,
        {},
        10000,
        "Buscar informações do produto"
      );

      const productId = await executeOrLog(
        getProductId,
        {
          data: productResponse,
          tamanho: executionParams.productNumber,
        },
        null,
        "Buscar id do produto"
      );

      const twoFactorProductId = await executeOrLog(
        getProductTwoFactorId,
        {
          data: productResponse,
          tamanho: executionParams.productNumber,
        },
        null,
        "Buscar id de fator duplo do produto"
      );

      return { productId, twoFactorProductId };
    },
    {},
    0,
    "Buscar informações do produto"
  );

  const cartAddFn = async () =>
    await executeOrLog(
      cartAdd,
      {
        cookie,
        referer: executionParams.product,
        productId: productId,
      },
      null,
      "Adicionar produto no carrinho"
    );

  const productCartAddResponse = await infineRetry(
    cartAddFn,
    {},
    10000,
    "Adicionar produto no carrinho"
  );

  // bough product
  //   const buyProductFn = async () =>
  //     await executeOrLog(
  //       buyProduct,
  //       {
  //         cookie,
  //         cardInformations,
  //         deliveryInformations,
  //       },
  //       null,
  //       "Comprar produto"
  //     );

  //   await infineRetry(buyProductFn, {}, 5000, "Comprar produto");
  //   return;
};

bot();
