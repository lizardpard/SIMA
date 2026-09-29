(() => {
  'use strict';

  /* =========================================================
     SIMA · Sistema de Monitoramento Ambiental
     ========================================================= */


  /* =========================================================
     CONFIGURAÇÃO
     ========================================================= */

  const CFG = {

    // Quando houver API/PHP, coloque a URL aqui.
    // Enquanto estiver vazio, o site usa dados/medicoes.json.
    API_URL: '',

    ARQUIVO: 'medicoes.json',

    PARQUES: [
      {
        id: 'dois-irmaos',
        nome: 'Parque Dois Irmãos'
      },
      {
        id: 'macaxeira',
        nome: 'Parque da Macaxeira'
      },
      {
        id: 'tamarineira',
        nome: 'Parque da Tamarineira'
      },
      {
        id: 'jardim-poco',
        nome: 'Jardim do Poço'
      },
      {
        id: 'jaqueira',
        nome: 'Parque da Jaqueira'
      },
      {
        id: 'pina',
        nome: 'Parque Gov. Eduardo Campos'
      }
    ],

    CORES: [
      '#0f7ea3',
      '#d8503f',
      '#e59a0c',
      '#2e9d5b',
      '#8a4fa0',
      '#5b6b73'
    ],

    // Limites usados pelo painel.
    // MQ-135 permanece sem limite até calibração.
    LIM: {
      co2: [600, 1000],
      mq135: null
    }
  };


  /* =========================================================
     VARIÁVEIS MONITORADAS
     ========================================================= */

  const V = {

    temperatura: [
      'Temperatura',
      '°C',
      1,
      'DHT22'
    ],

    umidade: [
      'Umidade relativa',
      '%',
      0,
      'DHT22'
    ],

    co2: [
      'CO₂',
      'ppm',
      0,
      'MG811'
    ],

    mq135: [
      'Gases (MQ-135)',
      'ppm eq.',
      0,
      'MQ-135'
    ],

    sensacao: [
      'Sensação térmica',
      '°C',
      1,
      'calculada'
    ],

    orvalho: [
      'Ponto de orvalho',
      '°C',
      1,
      'calculada'
    ]
  };


  const PER = [
    ['24 h', 1],
    ['7 dias', 7],
    ['30 dias', 30],
    ['Tudo', 0]
  ];


  /* =========================================================
     ESTADO DO SITE
     ========================================================= */

  const S = {

    aba: 'cid',

    park: CFG.PARQUES[0].id,

    sel: new Set([
      CFG.PARQUES[0].id
    ]),

    v: 'temperatura',

    per: 7,

    ant: false
  };


  let D = [];

  let FIM = Date.now();

  const DAY = 864e5;


  /* =========================================================
     UTILITÁRIOS
     ========================================================= */

  const $ = seletor =>
    document.querySelector(seletor);


  const num = valor =>
    typeof valor === 'number' &&
    Number.isFinite(valor);


  function el(tag, classe, texto) {

    const elemento =
      document.createElement(tag);

    if (classe) {
      elemento.className = classe;
    }

    if (texto != null) {
      elemento.textContent = texto;
    }

    return elemento;
  }


  function fmt(valor, casas = 1) {

    if (!num(valor)) {
      return '—';
    }

    return valor.toLocaleString(
      'pt-BR',
      {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas
      }
    );
  }


  function T(medicao) {

    return +new Date(
      medicao.data_hora
    );
  }


  function quando(timestamp) {

    return new Date(timestamp)
      .toLocaleString(
        'pt-BR',
        {
          dateStyle: 'short',
          timeStyle: 'short'
        }
      );
  }


  function dia(timestamp) {

    return new Date(timestamp)
      .toLocaleDateString(
        'pt-BR',
        {
          day: '2-digit',
          month: '2-digit'
        }
      );
  }


  function hora(timestamp) {

    return new Date(timestamp)
      .toLocaleTimeString(
        'pt-BR',
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      );
  }


  function idx(id) {

    return CFG.PARQUES
      .findIndex(
        parque => parque.id === id
      );
  }


  function nome(id) {

    const parque =
      CFG.PARQUES.find(
        p => p.id === id
      );

    return parque
      ? parque.nome
      : id;
  }


  function cor(id) {

    const indice = idx(id);

    return CFG.CORES[
      Math.max(0, indice) %
      CFG.CORES.length
    ];
  }


  function med(pontos) {

    if (!pontos.length) {
      return NaN;
    }

    return pontos.reduce(
      (soma, ponto) =>
        soma + ponto.v,
      0
    ) / pontos.length;
  }


  function nice(valor) {

    const potencia =
      10 **
      Math.floor(
        Math.log10(valor || 1)
      );

    const fator =
      valor / potencia;

    return (
      fator < 1.5 ? 1 :
      fator < 3   ? 2 :
      fator < 7   ? 5 :
                    10
    ) * potencia;
  }


  /* =========================================================
     CÁLCULOS AMBIENTAIS
     ========================================================= */


  // Índice de calor de Rothfusz.
  function sens(temperatura, umidade) {

    const fahrenheit =
      temperatura * 1.8 + 32;

    if (fahrenheit < 80) {
      return temperatura;
    }

    const h =
      -42.379 +
      2.04901523 * fahrenheit +
      10.14333127 * umidade -
      0.22475541 *
        fahrenheit *
        umidade -
      0.00683783 *
        fahrenheit *
        fahrenheit -
      0.05481717 *
        umidade *
        umidade +
      0.00122874 *
        fahrenheit *
        fahrenheit *
        umidade +
      0.00085282 *
        fahrenheit *
        umidade *
        umidade -
      0.00000199 *
        fahrenheit *
        fahrenheit *
        umidade *
        umidade;

    return (h - 32) / 1.8;
  }


  // Ponto de orvalho pela fórmula de Magnus.
  function orv(temperatura, umidade) {

    if (umidade <= 0) {
      return NaN;
    }

    const g =
      Math.log(umidade / 100) +
      17.62 *
      temperatura /
      (243.12 + temperatura);

    return (
      243.12 *
      g /
      (17.62 - g)
    );
  }


  function enriquecer(medicao) {

    const m = { ...medicao };

    if (
      num(m.temperatura) &&
      num(m.umidade)
    ) {

      m.sensacao =
        sens(
          m.temperatura,
          m.umidade
        );

      m.orvalho =
        orv(
          m.temperatura,
          m.umidade
        );
    }

    return m;
  }


  /* =========================================================
     CONSULTA DAS MEDIÇÕES
     ========================================================= */

  function serie(
    id,
    variavel,
    dias,
    deslocamento = 0
  ) {

    const fim =
      FIM - deslocamento;

    const inicio =
      dias
        ? fim - dias * DAY
        : -Infinity;

    return D
      .filter(m =>
        m.parque === id &&
        num(m[variavel]) &&
        T(m) > inicio &&
        T(m) <= fim
      )
      .map(m => ({
        t: T(m) + deslocamento,
        v: m[variavel]
      }))
      .sort(
        (a, b) => a.t - b.t
      );
  }


  function ultima(id) {

    let resultado = null;

    for (const m of D) {

      if (
        m.parque === id &&
        (
          !resultado ||
          T(m) > T(resultado)
        )
      ) {
        resultado = m;
      }
    }

    return resultado;
  }


  /* =========================================================
     PERFIL MÉDIO POR HORA
     ========================================================= */

  function perfil(
    id,
    variavel,
    dias
  ) {

    const grupos =
      Array.from(
        { length: 24 },
        () => []
      );

    const inicio =
      dias
        ? FIM - dias * DAY
        : -Infinity;


    for (const m of D) {

      if (
        m.parque === id &&
        num(m[variavel]) &&
        T(m) > inicio
      ) {

        const h =
          new Date(
            m.data_hora
          ).getHours();

        grupos[h].push({
          v: m[variavel]
        });
      }
    }


    return grupos
      .map(
        (grupo, h) => ({
          t: h,
          v: med(grupo)
        })
      )
      .filter(
        ponto => num(ponto.v)
      );
  }


  /* =========================================================
     ESTATÍSTICAS
     ========================================================= */

  function est(pontos) {

    const n = pontos.length;

    if (!n) {
      return null;
    }

    const valores =
      pontos.map(
        ponto => ponto.v
      );

    const media =
      med(pontos);


    const desvio =
      Math.sqrt(
        valores.reduce(
          (soma, valor) =>
            soma +
            (valor - media) ** 2,
          0
        ) / n
      );


    let tendencia = NaN;


    if (n > 2) {

      const mediaTempo =
        pontos.reduce(
          (soma, ponto) =>
            soma + ponto.t,
          0
        ) / n;


      let a = 0;
      let b = 0;


      for (const ponto of pontos) {

        a +=
          (ponto.t - mediaTempo) *
          (ponto.v - media);

        b +=
          (ponto.t - mediaTempo) ** 2;
      }


      tendencia =
        b
          ? a / b * DAY
          : NaN;
    }


    return {

      n,

      min:
        Math.min(...valores),

      max:
        Math.max(...valores),

      m:
        media,

      sd:
        desvio,

      last:
        valores[
          valores.length - 1
        ],

      tr:
        tendencia
    };
  }


  /* =========================================================
     CLASSIFICAÇÃO
     ========================================================= */

  const nv = (
    valor,
    [atencao, ruim]
  ) => {

    if (valor <= atencao) {
      return 0;
    }

    if (valor <= ruim) {
      return 1;
    }

    return 2;
  };


  function situacao(m) {

    if (!m) {

      return {
        n: 'd',
        t: 'Sem medição',
        x:
          'Ainda não recebemos leituras deste parque.'
      };
    }


    const niveis = [];
    const motivos = [];

    let calor = false;
    let ar = false;


    if (num(m.sensacao)) {

      calor = true;

      const n =
        m.sensacao < 32
          ? 0
          : m.sensacao <= 41
            ? 1
            : 2;

      niveis.push(n);

      if (n) {

        motivos.push(
          'Sensação térmica de ' +
          fmt(m.sensacao, 0) +
          ' °C'
        );
      }
    }


    for (
      const k of ['co2', 'mq135']
    ) {

      if (
        num(m[k]) &&
        CFG.LIM[k]
      ) {

        ar = true;

        const n =
          nv(
            m[k],
            CFG.LIM[k]
          );

        niveis.push(n);


        if (n) {

          motivos.push(
            V[k][0] +
            (
              n === 1
                ? ' um pouco alto'
                : ' muito alto'
            )
          );
        }
      }
    }


    if (!niveis.length) {

      return {
        n: 'd',
        t: 'Dados insuficientes',
        x:
          'Faltam dados suficientes para gerar uma avaliação.'
      };
    }


    const n =
      Math.max(...niveis);


    const explicacoes = [

      'Clima e ar dentro dos parâmetros definidos pelo sistema.',

      'Alguns indicadores ambientais merecem atenção.',

      'Foram detectados indicadores ambientais em nível elevado.'

    ];


    return {

      n,

      t: [
        'Condições favoráveis',
        'Atenção',
        'Condição desfavorável'
      ][n],

      x:
        (
          motivos.length
            ? motivos.join('; ') + '. '
            : ''
        ) +

        explicacoes[n] +

        (
          calor && ar
            ? ''
            :
              ' Avaliação parcial devido à ausência de alguns indicadores.'
        )
    };
  }


  const wCalor = s =>
    s < 27
      ? 'Agradável'
      : s < 32
        ? 'Quente'
        : s < 41
          ? 'Muito quente'
          : 'Calor elevado';


  const wUmid = u =>
    u < 40
      ? 'Ar seco'
      : u <= 70
        ? 'Faixa intermediária'
        : u <= 85
          ? 'Úmido'
          : 'Muito úmido';


  const wCo2 = c =>
    c <= CFG.LIM.co2[0]
      ? 'Concentração baixa'
      : c <= CFG.LIM.co2[1]
        ? 'Concentração intermediária'
        : 'Concentração elevada';


  /* =========================================================
     TOOLTIP
     ========================================================= */

  const NS =
    'http://www.w3.org/2000/svg';


  function tip(
    evento,
    titulo,
    linhas
  ) {

    const tooltip =
      $('#tip');

    if (!tooltip) {
      return;
    }


    if (!linhas) {

      tooltip.hidden = true;
      return;
    }


    tooltip.replaceChildren(
      el(
        'b',
        '',
        titulo
      )
    );


    for (
      const [c, n, v]
      of linhas
    ) {

      const linha =
        el('div');

      const ponto =
        el(
          'i',
          'dot'
        );

      ponto.style.background = c;


      linha.append(
        ponto,
        el(
          'span',
          '',
          n
            ? `${n}: ${v}`
            : v
        )
      );


      tooltip.append(linha);
    }


    tooltip.hidden = false;


    if (!evento) {
      return;
    }


    const largura =
      tooltip.offsetWidth;

    const altura =
      tooltip.offsetHeight;


    let x =
      evento.clientX + 14;

    let y =
      evento.clientY -
      altura -
      10;


    if (
      x + largura >
      window.innerWidth - 8
    ) {

      x =
        evento.clientX -
        largura -
        14;
    }


    if (x < 8) {
      x = 8;
    }


    if (y < 8) {

      y =
        evento.clientY + 18;
    }


    tooltip.style.left =
      `${x}px`;

    tooltip.style.top =
      `${y}px`;
  }


  /* =========================================================
     GRÁFICOS SVG RESPONSIVOS
     ========================================================= */

  function chart(
    host,
    series,
    opcoes = {}
  ) {

    host.replaceChildren();


    const todas =
      series.flatMap(
        serie => serie.pts
      );


    if (!todas.length) {

      host.append(
        el(
          'p',
          'mute',
          'Sem medições neste período.'
        )
      );

      return;
    }


    /*
       O SVG usa viewBox.
       Portanto ele se adapta automaticamente
       à largura do celular, tablet ou computador.
    */

    const W = 680;

    const larguraTela =
      host.clientWidth ||
      window.innerWidth;


    const mobile =
      larguraTela < 520;


    const H =
      opcoes.h ||
      (
        mobile
          ? 240
          : 280
      );


    const L =
      mobile ? 42 : 50;

    const R = 14;

    const TOP = 16;

    const B =
      mobile ? 34 : 32;

    const casas =
      opcoes.d ?? 1;


    let x0 =
      Math.min(
        ...todas.map(
          ponto => ponto.t
        )
      );


    let x1 =
      Math.max(
        ...todas.map(
          ponto => ponto.t
        )
      );


    let lo =
      Math.min(
        ...todas.map(
          ponto => ponto.v
        )
      );


    let hi =
      Math.max(
        ...todas.map(
          ponto => ponto.v
        )
      );


    if (x1 === x0) {
      x1 = x0 + 1;
    }


    if (hi === lo) {

      hi += 1;
      lo -= 1;
    }


    const passo =
      nice(
        (hi - lo) / 4
      );


    lo =
      Math.floor(
        lo / passo
      ) * passo;


    hi =
      Math.ceil(
        hi / passo
      ) * passo;


    const formatarX =
      opcoes.xf ||
      (
        (x1 - x0) <
        2 * DAY
          ? hora
          : dia
      );


    const formatarTooltip =
      opcoes.tf ||
      quando;


    const X = t =>
      L +
      (
        (t - x0) /
        (x1 - x0)
      ) *
      (
        W - L - R
      );


    const Y = v =>
      H -
      B -
      (
        (v - lo) /
        (hi - lo)
      ) *
      (
        H -
        B -
        TOP
      );


    const svg =
      document.createElementNS(
        NS,
        'svg'
      );


    svg.setAttribute(
      'viewBox',
      `0 0 ${W} ${H}`
    );


    svg.setAttribute(
      'class',
      'ch'
    );


    svg.setAttribute(
      'preserveAspectRatio',
      'xMidYMid meet'
    );


    svg.setAttribute(
      'role',
      'img'
    );


    svg.setAttribute(
      'aria-label',

      (
        opcoes.t ||
        'Gráfico'
      ) +

      ', ' +

      series
        .map(s => s.nome)
        .join(', ')
    );


    function add(
      tag,
      atributos
    ) {

      const elemento =
        document.createElementNS(
          NS,
          tag
        );


      for (
        const chave
        in atributos
      ) {

        elemento.setAttribute(
          chave,
          atributos[chave]
        );
      }


      svg.append(elemento);

      return elemento;
    }


    /* Linhas horizontais */

    for (
      let valor = lo;
      valor <= hi + 1e-9;
      valor += passo
    ) {

      add(
        'line',
        {
          x1: L,
          x2: W - R,
          y1: Y(valor),
          y2: Y(valor),
          class: 'gr'
        }
      );


      const texto =
        add(
          'text',
          {
            x: L - 7,
            y: Y(valor) + 4,
            class: 'ax',
            'text-anchor': 'end'
          }
        );


      texto.textContent =
        fmt(
          valor,
          casas
        );
    }


    /*
       No celular usamos menos rótulos
       para não ficarem sobrepostos.
    */

    const marcacoesX =
      mobile ? 2 : 4;


    for (
      let i = 0;
      i <= marcacoesX;
      i++
    ) {

      const t =
        x0 +
        (
          (x1 - x0) *
          i /
          marcacoesX
        );


      const texto =
        add(
          'text',
          {
            x: X(t),
            y: H - 9,
            class: 'ax',

            'text-anchor':
              i === 0
                ? 'start'
                : i === marcacoesX
                  ? 'end'
                  : 'middle'
          }
        );


      texto.textContent =
        formatarX(t);
    }


    /* Séries */

    for (
      const serie
      of series
    ) {

      if (
        serie.pts.length > 1
      ) {

        add(
          'polyline',
          {

            points:
              serie.pts
                .map(
                  ponto =>
                    X(ponto.t)
                      .toFixed(1) +
                    ',' +
                    Y(ponto.v)
                      .toFixed(1)
                )
                .join(' '),

            class: 'ln',

            stroke:
              serie.cor,

            'stroke-dasharray':
              serie.tr
                ? '6 5'
                : 'none'
          }
        );
      }


      /*
         Muitos círculos deixam gráficos
         grandes pesados.

         No celular reduzimos ainda mais.
      */

      const limitePontos =
        mobile ? 35 : 70;


      if (
        serie.pts.length <=
        limitePontos
      ) {

        serie.pts.forEach(
          ponto => {

            add(
              'circle',
              {
                cx: X(ponto.t),
                cy: Y(ponto.v),
                r: mobile
                  ? 3.2
                  : 2.8,
                fill: serie.cor
              }
            );

          }
        );
      }
    }


    /* Linha do cursor */

    const cursor =
      add(
        'line',
        {
          y1: TOP,
          y2: H - B,
          class: 'cur',
          visibility: 'hidden'
        }
      );


    function apontar(evento) {

      const retangulo =
        svg.getBoundingClientRect();


      const posicao =
        (
          evento.clientX -
          retangulo.left
        ) /
        retangulo.width;


      const svgX =
        posicao * W;


      const tempo =
        x0 +
        (
          (
            svgX - L
          ) /
          (
            W - L - R
          )
        ) *
        (
          x1 - x0
        );


      const linhas = [];

      let tempoEscolhido = null;


      for (
        const serie
        of series
      ) {

        let melhor = null;


        for (
          const ponto
          of serie.pts
        ) {

          if (
            !melhor ||
            Math.abs(
              ponto.t -
              tempo
            ) <
            Math.abs(
              melhor.t -
              tempo
            )
          ) {

            melhor = ponto;
          }
        }


        if (melhor) {

          linhas.push([
            serie.cor,
            serie.nome,
            fmt(
              melhor.v,
              casas
            ) +
            ' ' +
            (
              opcoes.u ||
              ''
            )
          ]);


          if (
            tempoEscolhido == null
          ) {

            tempoEscolhido =
              melhor.t;
          }
        }
      }


      if (
        tempoEscolhido == null
      ) {

        return;
      }


      cursor.setAttribute(
        'x1',
        X(tempoEscolhido)
      );


      cursor.setAttribute(
        'x2',
        X(tempoEscolhido)
      );


      cursor.setAttribute(
        'visibility',
        'visible'
      );


      tip(
        evento,
        formatarTooltip(
          tempoEscolhido
        ),
        linhas
      );
    }


    svg.addEventListener(
      'pointermove',
      apontar
    );


    svg.addEventListener(
      'pointerdown',
      apontar
    );


    svg.addEventListener(
      'pointerleave',
      () => {

        cursor.setAttribute(
          'visibility',
          'hidden'
        );

        tip(
          null,
          '',
          null
        );
      }
    );


    host.append(svg);


    /* Legenda */

    if (
      series.length > 1
    ) {

      const legenda =
        el(
          'div',
          'leg'
        );


      for (
        const serie
        of series
      ) {

        const item =
          el('span');


        const ponto =
          el(
            'i',
            'dot'
          );


        ponto.style.background =
          serie.cor;


        item.append(
          ponto,
          serie.nome +
          (
            serie.tr
              ? ' (período anterior)'
              : ''
          )
        );


        legenda.append(item);
      }


      host.append(legenda);
    }
  }


  /* =========================================================
     PAINEL DE GRÁFICO
     ========================================================= */

  const box = (
    titulo,
    funcao,
    opcoes
  ) => {

    const painel =
      el(
        'div',
        'panel'
      );


    if (titulo) {

      painel.append(
        el(
          'h3',
          '',
          titulo
        )
      );
    }


    const host =
      el('div');


    painel.append(host);


    funcao(
      host,
      opcoes
    );


    return painel;
  };


  /* =========================================================
     CHIPS DE PARQUES
     ========================================================= */

  function chips(multiplo) {

    const lista =
      el(
        'ul',
        'chips'
      );


    for (
      const parque
      of CFG.PARQUES
    ) {

      const li =
        el('li');


      const botao =
        el('button');


      const ponto =
        el(
          'i',
          'dot'
        );


      ponto.style.background =
        cor(parque.id);


      botao.type =
        'button';


      botao.setAttribute(

        'aria-pressed',

        multiplo
          ? S.sel.has(parque.id)
          : S.park === parque.id

      );


      botao.append(
        ponto,
        parque.nome
      );


      botao.onclick = () => {

        if (multiplo) {

          if (
            S.sel.has(parque.id)
          ) {

            /*
               Mantém pelo menos um parque
               selecionado.
            */

            if (
              S.sel.size > 1
            ) {

              S.sel.delete(
                parque.id
              );
            }

          } else {

            S.sel.add(
              parque.id
            );
          }

        } else {

          S.park =
            parque.id;
        }


        render();
      };


      li.append(botao);

      lista.append(li);
    }


    return lista;
  }


  /* =========================================================
     CAIXA DE SITUAÇÃO
     ========================================================= */

  function sitBox(m) {

    const situ =
      situacao(m);


    const box =
      el(
        'div',
        'sit n' + situ.n
      );


    const texto =
      el('div');


    const icones = {
      0: '✓',
      1: '!',
      2: '×',
      d: '?'
    };


    box.append(
      el(
        'span',
        'ico',
        icones[situ.n] || '?'
      )
    );


    let descricao =
      situ.x;


    if (
      m &&
      Date.now() - T(m) >
      108e5
    ) {

      descricao +=
        ' A última leitura disponível tem mais de 3 horas.';
    }


    texto.append(

      el(
        'b',
        '',
        situ.t
      ),

      el(
        'p',
        'mute',
        descricao
      )

    );


    box.append(texto);


    return box;
  }


  /* =========================================================
     CARD
     ========================================================= */

  function card(
    rotulo,
    valor,
    descricao
  ) {

    const c =
      el(
        'div',
        'card'
      );


    c.append(

      el(
        'div',
        'l',
        rotulo
      ),

      el(
        'div',
        'v',
        valor
      )

    );


    if (descricao) {

      c.append(
        el(
          'div',
          'w',
          descricao
        )
      );
    }


    return c;
  }


  /* =========================================================
     ABA "PARA TODOS"
     ========================================================= */

  function cidadao() {

    const painel =
      $('#p-cid');


    if (!painel) {
      return;
    }


    painel.replaceChildren();


    const id =
      S.park;


    const ultimaMedicao =
      ultima(id);


    painel.append(

      el(
        'h3',
        '',
        'Escolha um parque'
      ),

      chips(false)

    );


    /* HERO */

    const hero =
      el(
        'div',
        'hero'
      );


    hero.append(

      el(
        'div',
        'big',

        num(
          ultimaMedicao?.temperatura
        )

          ? fmt(
              ultimaMedicao.temperatura,
              0
            ) + '°'

          : '—'
      )

    );


    const textoHero =
      el('div');


    textoHero.append(

      el(
        'h2',
        '',
        nome(id)
      )

    );


    if (ultimaMedicao) {

      let texto = '';


      if (
        num(
          ultimaMedicao.sensacao
        )
      ) {

        texto +=
          'Sensação de ' +

          fmt(
            ultimaMedicao.sensacao,
            0
          ) +

          '°, ' +

          wCalor(
            ultimaMedicao.sensacao
          ).toLowerCase() +

          '. ';
      }


      texto +=
        'Atualizado em ' +
        quando(
          T(ultimaMedicao)
        ) +
        '.';


      textoHero.append(
        el(
          'p',
          '',
          texto
        )
      );

    } else {

      textoHero.append(
        el(
          'p',
          '',
          'Nenhuma medição recebida deste parque ainda.'
        )
      );
    }


    hero.append(
      textoHero
    );


    painel.append(
      hero,
      sitBox(
        ultimaMedicao
      )
    );


    /* INDICADORES */

    const grade =
      el(
        'div',
        'grid'
      );


    grade.append(

      card(

        'Umidade do ar',

        num(
          ultimaMedicao?.umidade
        )
          ? fmt(
              ultimaMedicao.umidade,
              0
            ) + '%'
          : '—',

        num(
          ultimaMedicao?.umidade
        )
          ? wUmid(
              ultimaMedicao.umidade
            )
          : 'Sem medição'

      )

    );


    grade.append(

      card(

        'Ar (CO₂)',

        num(
          ultimaMedicao?.co2
        )
          ? fmt(
              ultimaMedicao.co2,
              0
            ) + ' ppm'
          : '—',

        num(
          ultimaMedicao?.co2
        )
          ? wCo2(
              ultimaMedicao.co2
            )
          : 'Sem medição'

      )

    );


    grade.append(

      card(

        'Outros gases no ar',

        num(
          ultimaMedicao?.mq135
        )
          ? fmt(
              ultimaMedicao.mq135,
              0
            )
          : '—',

        num(
          ultimaMedicao?.mq135
        )
          ? 'Indicador relativo do MQ-135'
          : 'Sem medição'

      )

    );


    if (
      num(
        ultimaMedicao?.orvalho
      )
    ) {

      grade.append(

        card(

          'Ponto de orvalho',

          fmt(
            ultimaMedicao.orvalho,
            1
          ) + ' °C',

          'Calculado pela temperatura e umidade'

        )

      );
    }


    const atual =
      serie(
        id,
        'temperatura',
        1
      );


    const anterior =
      serie(
        id,
        'temperatura',
        1,
        DAY
      );


    const mediaAtual =
      med(atual);


    const mediaAnterior =
      med(anterior);


    grade.append(

      card(

        'Hoje comparado a ontem',

        num(mediaAtual) &&
        num(mediaAnterior)

          ? (
              mediaAtual >=
              mediaAnterior
                ? '+'
                : '−'
            ) +

            fmt(
              Math.abs(
                mediaAtual -
                mediaAnterior
              ),
              1
            ) +

            ' °C'

          : '—',

        num(mediaAtual) &&
        num(mediaAnterior)

          ? 'Média das últimas 24 h comparada às 24 h anteriores'

          : 'São necessários pelo menos 2 dias de medições'

      )

    );


    painel.append(

      el(
        'h3',
        '',
        'Como o ambiente está'
      ),

      grade

    );


    /* GRÁFICOS 24H */

    painel.append(

      el(
        'h3',
        '',
        'Últimas 24 horas'
      )

    );


    const dois =
      el(
        'div',
        'two'
      );


    for (
      const k
      of [
        'temperatura',
        'umidade'
      ]
    ) {

      dois.append(

        box(
          V[k][0],

          host =>
            chart(

              host,

              [
                {
                  nome:
                    V[k][0],

                  cor:
                    cor(id),

                  pts:
                    serie(
                      id,
                      k,
                      1
                    )
                }
              ],

              {
                u:
                  V[k][1],

                d:
                  V[k][2],

                t:
                  V[k][0]
              }

            )
        )
      );
    }


    painel.append(dois);


    /* TODOS OS PARQUES */

    painel.append(

      el(
        'h3',
        '',
        'Todos os parques agora'
      )

    );


    const todos =
      el(
        'div',
        'grid'
      );


    for (
      const parque
      of CFG.PARQUES
    ) {

      const m =
        ultima(
          parque.id
        );


      const situ =
        situacao(m);


      const botao =
        el(
          'button',
          'card pk'
        );


      botao.type =
        'button';


      const icones = {
        0: '✓ ',
        1: '! ',
        2: '× ',
        d: ''
      };


      botao.append(

        el(
          'div',
          'l',
          parque.nome
        ),

        el(
          'div',
          'v',

          num(
            m?.temperatura
          )
            ? fmt(
                m.temperatura,
                0
              ) + '°'
            : '—'
        ),

        el(
          'div',
          'w',

          (
            icones[situ.n] ||
            ''
          ) +

          situ.t
        )
      );


      botao.onclick =
        () => {

          S.park =
            parque.id;

          render();

          window.scrollTo({
            top: 0,
            behavior:
              window.matchMedia(
                '(prefers-reduced-motion: reduce)'
              ).matches
                ? 'auto'
                : 'smooth'
          });
        };


      todos.append(
        botao
      );
    }


    painel.append(todos);


    /* EXPLICAÇÕES */

    const detalhes =
      el('details');


    detalhes.append(

      el(
        'summary',
        '',
        'Entenda os indicadores'
      )

    );


    const textos = [

      'Sensação térmica: estimativa de como a combinação entre temperatura e umidade pode ser percebida pelo corpo.',

      'CO₂: concentração de dióxido de carbono registrada pelo sensor MG811.',

      'MQ-135: sensor que reage a diferentes gases. Sem calibração específica, seus valores devem ser interpretados principalmente como variação relativa.',

      'Ponto de orvalho: temperatura na qual o vapor de água presente no ar começaria a se condensar.',

      'As medições apresentadas pelo SIMA são produzidas por sensores de baixo custo e devem ser interpretadas como indicadores ambientais.'

    ];


    for (
      const texto
      of textos
    ) {

      detalhes.append(
        el(
          'p',
          '',
          texto
        )
      );
    }


    painel.append(
      detalhes
    );
  }


  /* =========================================================
     EXPORTAÇÃO CSV
     ========================================================= */

  function csv() {

    const variaveis =
      Object.keys(V);


    const inicio =
      S.per
        ? FIM -
          S.per *
          DAY
        : -Infinity;


    const linhas = [

      [
        'parque',
        'data_hora',
        ...variaveis
      ].join(',')

    ];


    for (
      const m
      of D
    ) {

      if (
        S.sel.has(m.parque) &&
        T(m) > inicio
      ) {

        linhas.push(

          [
            m.parque,
            m.data_hora,

            ...variaveis.map(
              k =>
                num(m[k])
                  ? m[k]
                  : ''
            )

          ].join(',')

        );
      }
    }


    const blob =
      new Blob(
        [
          '\uFEFF' +
          linhas.join('\n')
        ],
        {
          type:
            'text/csv;charset=utf-8'
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const link =
      el('a');


    link.href = url;

    link.download =
      'sima-medicoes.csv';


    document.body.append(
      link
    );


    link.click();

    link.remove();


    setTimeout(
      () =>
        URL.revokeObjectURL(
          url
        ),
      1000
    );
  }


  /* =========================================================
     SELECT
     ========================================================= */

  function sel(
    rotulo,
    opcoes,
    valor,
    funcao
  ) {

    const label =
      el(
        'label',
        '',
        rotulo
      );


    const select =
      el('select');


    for (
      const [valorOpcao, nomeOpcao]
      of opcoes
    ) {

      const option =
        el(
          'option',
          '',
          nomeOpcao
        );


      option.value =
        valorOpcao;


      if (
        String(valorOpcao) ===
        String(valor)
      ) {

        option.selected = true;
      }


      select.append(option);
    }


    select.onchange =
      () =>
        funcao(
          select.value
        );


    label.append(select);


    return label;
  }


  /* =========================================================
     ABA PESQUISA
     ========================================================= */

  function pesquisa() {

    const painel =
      $('#p-pes');


    if (!painel) {
      return;
    }


    painel.replaceChildren();


    const ids =
      [...S.sel];


    const k =
      S.v;


    const [
      nomeVariavel,
      unidade,
      casas
    ] =
      V[k];


    const unico =
      ids.length === 1 &&
      S.per > 0;


    painel.append(

      el(
        'h2',
        '',
        'Análise comparativa'
      ),

      el(
        'p',
        'mute',
        'Compare indicadores ambientais entre os parques e diferentes períodos.'
      ),

      el(
        'h3',
        '',
        'Parques'
      ),

      chips(true)

    );


    /* CONTROLES */

    const controles =
      el(
        'div',
        'ctl'
      );


    controles.append(

      sel(

        'Variável',

        Object.entries(V)
          .map(
            ([chave, valor]) =>
              [
                chave,
                `${valor[0]} (${valor[1]})`
              ]
          ),

        k,

        valor => {

          S.v = valor;
          render();

        }
      ),


      sel(

        'Período',

        PER.map(
          ([nome, valor]) =>
            [valor, nome]
        ),

        S.per,

        valor => {

          S.per =
            Number(valor);

          render();

        }
      )

    );


    /* COMPARAR PERÍODO ANTERIOR */

    const labelAnterior =
      el('label');


    const checkbox =
      el('input');


    checkbox.type =
      'checkbox';


    checkbox.checked =
      S.ant &&
      unico;


    checkbox.disabled =
      !unico;


    checkbox.onchange =
      () => {

        S.ant =
          checkbox.checked;

        render();
      };


    labelAnterior.style.flexDirection =
      'row';


    labelAnterior.style.alignItems =
      'center';


    labelAnterior.append(

      checkbox,

      'Comparar com período anterior'

    );


    controles.append(
      labelAnterior
    );


    /* CSV */

    const botaoCSV =
      el(
        'button',
        'btn',
        'Baixar CSV'
      );


    botaoCSV.type =
      'button';


    botaoCSV.onclick =
      csv;


    controles.append(
      botaoCSV
    );


    painel.append(
      controles
    );


    /* GRÁFICOS PRINCIPAIS */

    const dois =
      el(
        'div',
        'two'
      );


    dois.append(

      box(

        nomeVariavel +
        ' ao longo do tempo',

        host => {

          const series =
            ids.map(
              id => ({
                nome:
                  nome(id),

                cor:
                  cor(id),

                pts:
                  serie(
                    id,
                    k,
                    S.per
                  )
              })
            );


          if (
            S.ant &&
            unico
          ) {

            series.push({

              nome:
                nome(ids[0]) +
                ' — período anterior',

              cor:
                cor(ids[0]),

              pts:
                serie(
                  ids[0],
                  k,
                  S.per,
                  S.per * DAY
                ),

              tr: 1
            });
          }


          chart(

            host,

            series,

            {
              u:
                unidade,

              d:
                casas,

              t:
                nomeVariavel
            }
          );
        }
      )
    );


    dois.append(

      box(

        'Perfil médio por hora',

        host =>
          chart(

            host,

            ids.map(
              id => ({
                nome:
                  nome(id),

                cor:
                  cor(id),

                pts:
                  perfil(
                    id,
                    k,
                    S.per
                  )
              })
            ),

            {
              u:
                unidade,

              d:
                casas,

              t:
                'Perfil médio por hora',

              xf:
                t =>
                  Math.round(t) +
                  'h',

              tf:
                t =>
                  Math.round(t) +
                  'h'
            }

          )
      )
    );


    painel.append(dois);


    /* ESTATÍSTICAS */

    painel.append(

      el(
        'h3',
        '',
        'Estatísticas do período'
      )

    );


    const tabelaContainer =
      el(
        'div',
        'tab'
      );


    const tabela =
      el('table');


    const cabecalho =
      el('tr');


    const titulos = [

      'Parque',
      'Medições',
      'Mín.',
      'Média',
      'Máx.',
      'Desvio-padrão',
      'Última',
      'Tendência/dia'

    ];


    for (
      const titulo
      of titulos
    ) {

      cabecalho.append(
        el(
          'th',
          '',
          titulo
        )
      );
    }


    tabela.append(
      cabecalho
    );


    for (
      const id
      of ids
    ) {

      const estatistica =
        est(
          serie(
            id,
            k,
            S.per
          )
        );


      const linha =
        el('tr');


      linha.append(

        el(
          'td',
          '',
          nome(id)
        )

      );


      const valores =
        estatistica

          ? [

              estatistica.n,

              fmt(
                estatistica.min,
                casas
              ),

              fmt(
                estatistica.m,
                casas
              ),

              fmt(
                estatistica.max,
                casas
              ),

              fmt(
                estatistica.sd,
                casas + 1
              ),

              fmt(
                estatistica.last,
                casas
              ),

              num(
                estatistica.tr
              )

                ? (
                    estatistica.tr >= 0
                      ? '+'
                      : ''
                  ) +

                  fmt(
                    estatistica.tr,
                    casas + 1
                  ) +

                  ' ' +
                  unidade

                : '—'
            ]

          : [
              '0',
              '—',
              '—',
              '—',
              '—',
              '—',
              '—'
            ];


      for (
        const valor
        of valores
      ) {

        linha.append(

          el(
            'td',
            '',
            String(valor)
          )

        );
      }


      tabela.append(
        linha
      );
    }


    tabelaContainer.append(
      tabela
    );


    painel.append(
      tabelaContainer
    );


    /* PAINEL COMPLETO */

    const primeiro =
      ids[0];


    if (primeiro) {

      painel.append(

        el(
          'h3',
          '',
          'Painel completo: ' +
          nome(primeiro)
        )

      );


      const mini =
        el(
          'div',
          'mini'
        );


      for (
        const variavel
        of Object.keys(V)
      ) {

        mini.append(

          box(

            V[variavel][0] +
            ' (' +
            V[variavel][1] +
            ')',

            host =>
              chart(

                host,

                [
                  {
                    nome:
                      V[variavel][0],

                    cor:
                      cor(primeiro),

                    pts:
                      serie(
                        primeiro,
                        variavel,
                        S.per
                      )
                  }
                ],

                {
                  u:
                    V[variavel][1],

                  d:
                    V[variavel][2],

                  h:
                    210,

                  t:
                    V[variavel][0]
                }

              )
          )
        );
      }


      painel.append(mini);
    }


    /* SENSORES */

    const detalhes =
      el('details');


    detalhes.append(

      el(
        'summary',
        '',
        'Sensores e limitações'
      )

    );


    const containerSensores =
      el(
        'div',
        'tab'
      );


    const tabelaSensores =
      el('table');


    const cabecalhoSensores =
      el('tr');


    for (
      const titulo
      of [
        'Sensor',
        'Mede',
        'Faixa',
        'Observações'
      ]
    ) {

      cabecalhoSensores.append(

        el(
          'th',
          '',
          titulo
        )

      );
    }


    tabelaSensores.append(
      cabecalhoSensores
    );


    const sensores = [

      [
        'DHT22',
        'Temperatura e umidade',
        '−40 a 80 °C; 0 a 100% UR',
        'Deve permanecer protegido do sol direto e da chuva.'
      ],

      [
        'MG811',
        'CO₂',
        'Sensor de dióxido de carbono',
        'Requer calibração e período adequado de estabilização.'
      ],

      [
        'MQ-135',
        'Mistura de gases',
        'Indicador relativo',
        'Não é específico para um único gás e exige calibração para estimativas quantitativas.'
      ]

    ];


    for (
      const dados
      of sensores
    ) {

      const linha =
        el('tr');


      for (
        const valor
        of dados
      ) {

        linha.append(

          el(
            'td',
            '',
            valor
          )

        );
      }


      tabelaSensores.append(
        linha
      );
    }


    containerSensores.append(
      tabelaSensores
    );


    detalhes.append(

      containerSensores,

      el(
        'p',
        'mute',
        'Sensação térmica e ponto de orvalho são calculados a partir das medições de temperatura e umidade.'
      )

    );


    painel.append(
      detalhes
    );
  }


  /* =========================================================
     CARREGAMENTO AUTOMÁTICO DOS DADOS
     ========================================================= */

  function aceitar(json) {

    const lista =
      Array.isArray(json)
        ? json
        : json?.medicoes;


    if (
      !Array.isArray(lista)
    ) {

      throw new Error(
        'Formato de dados inválido.'
      );
    }


    const ids =
      new Set(
        CFG.PARQUES.map(
          parque =>
            parque.id
        )
      );


    D =
      lista
        .filter(
          medicao =>

            medicao &&

            ids.has(
              medicao.parque
            ) &&

            !Number.isNaN(
              T(medicao)
            )
        )
        .map(
          enriquecer
        );


    FIM =
      D.length

        ? Math.max(
            ...D.map(T)
          )

        : Date.now();


    const aviso =
      $('#aviso');


    /*
       #aviso agora é opcional.
       Se você apagou a barra do HTML,
       o JS continua funcionando normalmente.
    */

    if (aviso) {

      aviso.textContent =
        D.length

          ? `${D.length.toLocaleString('pt-BR')} medições disponíveis.`

          : 'Nenhuma medição disponível.';
    }


    render();
  }


  /* =========================================================
     RENDERIZAÇÃO DAS ABAS
     ========================================================= */

  function render() {

    const painelCid =
      $('#p-cid');


    const painelPes =
      $('#p-pes');


    const tabCid =
      $('#t-cid');


    const tabPes =
      $('#t-pes');


    if (
      !painelCid ||
      !painelPes ||
      !tabCid ||
      !tabPes
    ) {

      console.error(
        'SIMA: elementos principais do HTML não foram encontrados.'
      );

      return;
    }


    const cid =
      S.aba === 'cid';


    painelCid.hidden =
      !cid;


    painelPes.hidden =
      cid;


    tabCid.setAttribute(
      'aria-selected',
      String(cid)
    );


    tabPes.setAttribute(
      'aria-selected',
      String(!cid)
    );


    tabCid.tabIndex =
      cid ? 0 : -1;


    tabPes.tabIndex =
      cid ? -1 : 0;


    tip(
      null,
      '',
      null
    );


    if (cid) {
      cidadao();
    } else {
      pesquisa();
    }
  }


  /* =========================================================
     NAVEGAÇÃO
     ========================================================= */

  const tabCid =
    $('#t-cid');


  const tabPes =
    $('#t-pes');


  if (
    tabCid &&
    tabPes
  ) {

    tabCid.onclick =
      () => {

        S.aba = 'cid';
        render();

      };


    tabPes.onclick =
      () => {

        S.aba = 'pes';
        render();

      };


    const tabs =
      document.querySelector(
        '.tabs'
      );


    if (tabs) {

      tabs.onkeydown =
        evento => {

          if (
            evento.key !==
              'ArrowLeft' &&

            evento.key !==
              'ArrowRight'
          ) {

            return;
          }


          evento.preventDefault();


          S.aba =
            S.aba === 'cid'
              ? 'pes'
              : 'cid';


          render();


          (
            S.aba === 'cid'
              ? tabCid
              : tabPes
          ).focus();
        };
    }
  }


  /* =========================================================
     REDIMENSIONAMENTO
     ========================================================= */

  let resizeTimer;


  window.addEventListener(
    'resize',
    () => {

      clearTimeout(
        resizeTimer
      );


      resizeTimer =
        setTimeout(
          () => {

            /*
               Refaz os gráficos quando ocorre uma
               mudança importante no tamanho da tela.
            */

            render();

          },
          180
        );
    }
  );


  /* =========================================================
     INICIALIZAÇÃO
     ========================================================= */

  render();


  /*
     Carregamento automático.

     Primeiro tenta API_URL.
     Se estiver vazia, usa dados/medicoes.json.
  */

  fetch(
    CFG.API_URL ||
    CFG.ARQUIVO
  )

    .then(resposta => {

      if (!resposta.ok) {

        throw new Error(
          `HTTP ${resposta.status}`
        );
      }

      return resposta.json();

    })

    .then(
      aceitar
    )

    .catch(erro => {

      console.warn(
        'SIMA: não foi possível carregar as medições.',
        erro
      );


      const aviso =
        $('#aviso');


      if (aviso) {

        aviso.textContent =
          'Não foi possível carregar as medições.';
      }


      render();
    });

})();