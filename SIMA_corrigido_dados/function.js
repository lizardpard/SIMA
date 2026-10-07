(() => {
  'use strict';

  


  

  const CFG = {

    
    
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

    
    
    LIM: {
      co2: [1000, 1500],
      mq135: null
    }
  };


  

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


    if (num(m.temperatura)) {

      calor = true;

      const n =
        m.temperatura < 15 || m.temperatura > 30
          ? 2
          : m.temperatura < 18 || m.temperatura > 26
            ? 1
            : 0;

      niveis.push(n);

      if (n) {

        motivos.push(
          'Temperatura de ' +
          fmt(m.temperatura, 0) +
          ' °C'
        );
      }
    }


    if (num(m.umidade)) {

      const n =
        m.umidade < 30 || m.umidade > 85
          ? 2
          : m.umidade < 40 || m.umidade > 70
            ? 1
            : 0;

      niveis.push(n);

      if (n) {

        motivos.push(
          'Umidade relativa de ' +
          fmt(m.umidade, 0) +
          '% fora da faixa recomendada'
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

      'Os indicadores ambientais estão ruins e exigem cuidado imediato.'

    ];


    return {

      n,

      t: [
        'Condições favoráveis',
        'Atenção',
        'Ruim'
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
    s < 15
      ? 'Muito frio'
      : s < 18
        ? 'Frio'
        : s < 27
          ? 'Agradável'
          : s < 30
            ? 'Quente'
            : s < 34
              ? 'Muito quente'
              : 'Calor elevado';


  const wUmid = u =>
    u < 30
      ? 'Muito seco'
      : u < 40
        ? 'Ar seco'
        : u <= 60
          ? 'Equilibrada'
          : u <= 70
            ? 'Alta'
            : u <= 85
              ? 'Muito alta'
              : 'Extremamente úmida';


  function nivelMetric(metric, medicao) {

    if (!medicao) {
      return 0;
    }

    switch (metric) {

      case 'temperatura': {
        const valor = medicao.temperatura;

        return valor < 15 || valor > 30
          ? 2
          : valor < 18 || valor > 26
            ? 1
            : 0;
      }

      case 'umidade': {
        const valor = medicao.umidade;

        return valor < 30 || valor > 85
          ? 2
          : valor < 40 || valor > 70
            ? 1
            : 0;
      }

      case 'co2': {
        return num(medicao.co2)
          ? nv(medicao.co2, CFG.LIM.co2)
          : 0;
      }

      default:
        return 0;
    }
  }


  const wCo2 = c =>
    c <= 1000
      ? 'Concentração aceitável'
      : c <= 1500
        ? 'Concentração elevada'
        : 'Concentração crítica';


  

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
          'card pk n' + situ.n
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

    
    const parqueAtual = ultima(S.park);
    const estadoAtual = situacao(parqueAtual);

    painel.append(el('h3', '', 'O que esses dados significam para você?'));
    const guia = el('div', 'citizen-guide');
    const itensGuia = {
      0: [
        ['🌡️', 'Clima confortável', 'A temperatura e a sensação térmica ficam compatíveis com um ambiente mais agradável para a maioria das pessoas.'],
        ['💧', 'Umidade equilibrada', 'A umidade está em faixa que tende a aliviar a sensação de calor e manter o ar mais confortável.'],
        ['🌬️', 'Ar em bom nível', 'A concentração de CO₂ e os indicadores do ar não apontam para excesso horário significativo.'],
        ['🧪', 'Indicadores estáveis', 'Os gases monitorados permanecem dentro de uma faixa mais estável, sem indicar pressão ambiental forte.']
      ],
      1: [
        ['🌡️', 'Calor com atenção', 'A sensação térmica indica que o ambiente deve ser observado com mais cuidado, principalmente em horas mais quentes.'],
        ['💧', 'Umidade merece cuidado', 'A umidade alta pode deixar a sensação térmica mais cansativa e aumentar o desconforto.'],
        ['🌬️', 'CO₂ e gases em alerta', 'A concentração de CO₂ e outros gases pode estar mais elevada do que o ideal para a rotina do parque.'],
        ['🧪', 'Variações do ar', 'Mudanças nos gases monitorados podem sinalizar maior pressão do ambiente, mesmo sem valores extremos.']
      ],
      2: [
        ['🌡️', 'Calor elevado', 'A sensação térmica está alta e pode exigir atenção, especialmente para quem passa muito tempo ao ar livre.'],
        ['💧', 'Umidade muito alta', 'A combinação com a umidade pode tornar o ambiente mais pesado e desconfortável.'],
        ['🌬️', 'Qualidade do ar mais crítica', 'Os níveis de CO₂ ou gases do ar sugerem que o ambiente está em condição mais pesada.'],
        ['🧪', 'Indicadores em alerta', 'O monitoramento aponta que os gases podem estar fora da faixa mais confortável para o uso do espaço.']
      ],
      d: [
        ['📡', 'Dados ainda insuficientes', 'Ainda não temos leitura suficiente para avaliar o nível do ambiente com segurança.'],
        ['💧', 'Monitoramento em andamento', 'A qualidade da leitura pode mudar conforme novos dados forem chegando ao sistema.'],
        ['🌬️', 'Aguardar mais pontos', 'É importante comparar com séries mais longas antes de interpretar o cenário completo.'],
        ['🧪', 'Verificação contínua', 'O sistema continua acompanhando a variação para confirmar se os indicadores se estabilizam.']
      ]
    };

    for (const [icone, titulo, texto] of itensGuia[estadoAtual.n] || itensGuia.d) {
      const item = el('article', 'guide-card status-' + (estadoAtual.n === 'd' ? 'd' : estadoAtual.n));
      item.append(el('span', 'guide-icon', icone), el('h4', '', titulo), el('p', 'mute', texto));
      guia.append(item);
    }
    painel.append(guia);

    
    painel.append(el('h3', '', 'Comparação rápida · últimas 24 horas'));
    painel.append(el('p', 'mute', 'Médias das medições recentes para facilitar a comparação entre os parques monitorados.'));

    const compareDef = {
      temperatura: {
        label: 'Temperatura',
        unidade: '°C',
        casas: 1,
        icone: '🌡️',
        format: valor => fmt(valor, 1) + ' °C'
      },
      umidade: {
        label: 'Umidade',
        unidade: '%',
        casas: 0,
        icone: '💧',
        format: valor => fmt(valor, 0) + '%'
      },
      co2: {
        label: 'CO₂',
        unidade: ' ppm',
        casas: 0,
        icone: 'CO₂',
        format: valor => fmt(valor, 0) + ' ppm'
      }
    };

    const compareToolbar = el('div', 'compare-toolbar');
    const compareButtons = Object.entries(compareDef).map(([chave, meta]) => {
      const botao = el('button', 'compare-pill', meta.label);
      botao.type = 'button';
      botao.dataset.metric = chave;
      botao.addEventListener('click', () => {
        compareButtons.forEach(btn => btn.classList.toggle('active', btn === botao));
        compareMetric = chave;
        renderQuickCompare();
      });
      return botao;
    });
    compareButtons.forEach(botao => compareToolbar.append(botao));
    painel.append(compareToolbar);

    const comp = el('div', 'compare-simple');
    let compareMetric = 'temperatura';

    function renderQuickCompare() {
      comp.innerHTML = '';
      const meta = compareDef[compareMetric];
      const lista = CFG.PARQUES.map(parque => {
        const pontos = serie(parque.id, compareMetric, 1);
        const estat = est(pontos);
        return {
          parque,
          valor: estat ? estat.m : null,
          estat
        };
      }).filter(item => num(item.valor));

      if (!lista.length) {
        comp.append(el('p', 'empty-state', 'Nenhuma medição disponível para comparação no momento.'));
        return;
      }

      const media = med(lista.map(item => ({ v: item.valor })));
      const ranking = [...lista].sort((a, b) => b.valor - a.valor);
      const melhor = ranking[0];
      const pior = ranking[ranking.length - 1];

      ranking.forEach((item, index) => {
        const card = el('article', 'compare-card');
        const nivel = nivelMetric(compareMetric, ultima(item.parque.id));

        if (nivel === 2) {
          card.classList.add('is-hot');
        } else if (nivel === 1) {
          card.classList.add('is-mid');
        } else {
          card.classList.add('is-cool');
        }

        const destaque = nivel === 2
          ? 'Ruim'
          : nivel === 1
            ? 'Atenção'
            : 'Bom';

        const badge = el('span', 'compare-badge', destaque);
        const rank = el('span', 'compare-rank', '#' + (index + 1));
        const metaTop = el('div', 'compare-top');
        metaTop.append(badge, rank);
        card.append(metaTop);

        const titulo = el('h4', '', item.parque.nome);
        card.append(titulo);

        const valor = el('div', 'compare-main');
        valor.append(el('strong', 'compare-value', meta.format(item.valor)));
        if (num(media)) {
          const diferenca = item.valor - media;
          const rel = diferenca > 0 ? 'acima' : diferenca < 0 ? 'abaixo' : 'na média';
          const txt = `${rel} da média geral`;
          const delta = el('span', 'compare-delta', txt);
          valor.append(delta);
        }
        card.append(valor);

        const detalhes = el('div', 'compare-values');
        detalhes.append(
          el('span', '', '📊 ' + (item.estat ? 'média de ' + meta.format(item.estat.m) : 'sem dados')),
          el('span', '', '⏱️ ' + (item.estat ? 'última leitura ' + meta.format(item.estat.last) : '—'))
        );
        card.append(detalhes);
        comp.append(card);
      });
    }

    compareButtons[0]?.classList.add('active');
    renderQuickCompare();
    painel.append(comp);

    const avisoCid = el('div', 'info-note');
    avisoCid.append(el('b', '', 'Importante: '), document.createTextNode('o SIMA é um projeto de monitoramento ambiental com sensores de baixo custo. Os resultados ajudam a observar padrões e diferenças entre os parques, mas não substituem medições oficiais.'));
    painel.append(avisoCid);


    

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


    
    painel.append(el('h3', '', 'Qualidade e cobertura dos dados'));
    const qualidade = el('div', 'grid');
    const inicioPeriodo = S.per ? FIM - S.per * DAY : -Infinity;
    const dadosPeriodo = D.filter(m => ids.includes(m.parque) && T(m) > inicioPeriodo && T(m) <= FIM);
    const totalPossivel = dadosPeriodo.length * 4;
    const totalValidos = dadosPeriodo.reduce((soma,m) => soma + ['temperatura','umidade','co2','mq135'].filter(k => num(m[k])).length, 0);
    const cobertura = totalPossivel ? totalValidos / totalPossivel * 100 : NaN;
    qualidade.append(
      card('Registros no período', String(dadosPeriodo.length), ids.length + (ids.length === 1 ? ' parque selecionado' : ' parques selecionados')),
      card('Completude', num(cobertura) ? fmt(cobertura,1)+'%' : '—', 'Campos principais preenchidos'),
      card('Última atualização', D.length ? quando(FIM) : '—', 'Horário mais recente no conjunto de dados')
    );
    painel.append(qualidade);

    const bruto = el('details');
    bruto.append(el('summary', '', 'Ver dados brutos do período'));
    const brutoWrap = el('div', 'tab raw-table');
    const brutoTabela = el('table');
    const brutoHead = el('tr');
    for (const h of ['Parque','Data/hora','Temp.','Umidade','CO₂','MQ-135']) brutoHead.append(el('th','',h));
    brutoTabela.append(brutoHead);
    const amostra = dadosPeriodo.slice().sort((a,b)=>T(b)-T(a)).slice(0,120);
    for (const m of amostra) {
      const r=el('tr');
      for (const x of [nome(m.parque),quando(T(m)),num(m.temperatura)?fmt(m.temperatura,1)+' °C':'—',num(m.umidade)?fmt(m.umidade,0)+'%':'—',num(m.co2)?fmt(m.co2,0)+' ppm':'—',num(m.mq135)?fmt(m.mq135,0):'—']) r.append(el('td','',x));
      brutoTabela.append(r);
    }
    brutoWrap.append(brutoTabela); bruto.append(brutoWrap);
    if (dadosPeriodo.length > 120) bruto.append(el('p','mute','Mostrando os 120 registros mais recentes. Use “Baixar CSV” para acessar todos os registros selecionados.'));
    painel.append(bruto);

    const metodologia = el('details');
    metodologia.append(el('summary','','Como interpretar a análise'));
    metodologia.append(
      el('p','', 'Mínimo, média, máximo e desvio-padrão resumem a distribuição das medições no período selecionado.'),
      el('p','', 'A tendência por dia é uma estimativa linear da direção da série no período. Ela descreve o conjunto de dados e não é uma previsão.'),
      el('p','', 'O perfil médio por hora agrupa as medições pelo horário do dia, ajudando a visualizar o ciclo diário de cada indicador.'),
      el('p','', 'Ao selecionar vários parques, as linhas permitem comparar locais no mesmo gráfico. Para comparar um parque com o período anterior, selecione apenas um parque e ative a opção correspondente.')
    );
    painel.append(metodologia);

    

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


    

    if (aviso) {

      aviso.textContent =
        D.length

          ? `${D.length.toLocaleString('pt-BR')} medições disponíveis.`

          : 'Nenhuma medição disponível.';
    }


    render();
  }


  

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

            

            render();

          },
          180
        );
    }
  );


  

  render();


  

  const dadosEmbutidos = window.SIMA_DADOS;

  const carregamento = dadosEmbutidos
    ? Promise.resolve(dadosEmbutidos)
    : fetch(
        CFG.API_URL ||
        CFG.ARQUIVO
      ).then(resposta => {
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        return resposta.json();
      });

  carregamento

    .then(aceitar)

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