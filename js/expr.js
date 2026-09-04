// expr.js – lille formelsprog for regnskabsmotoren.
// Et udtryk kan evalueres (JS), oversættes til en Excel-formel og til læselig tekst.
//
// Grammatik:
//   expr    := term (('+'|'-') term)*
//   term    := unary (('*'|'/') unary)*
//   unary   := '-' unary | primary
//   primary := NUMBER | STRING | IDENT | IDENT '(' args ')' | '(' expr ')'
//
// Funktioner: SUM, ROUND, ABS, MIN, MAX, IFZERO(x, alt) (x hvis x<>0 ellers alt),
//   KONTO(nr)           = indsat - hævet for posteringer på kontonummer nr
//   LIKVIDIND("id")     = indsat på likvidkonto id
//   LIKVIDUD("id")      = hævet på likvidkonto id
//   SAFEDIV(a, b)       = a / b, 0 hvis b = 0
//   PLANRENTE("lån", år)     = renter og bidrag iflg. betalingsplan i året
//   PLANAFDRAG("lån", år)    = afdrag iflg. betalingsplan i året
//   PLANAFDRAGAKK("lån", år) = afdrag iflg. betalingsplan til og med året

export function tokenize(src) {
  const tokens = [];
  let i = 0;
  const s = String(src);
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      tokens.push({ t: 'num', v: parseFloat(s.slice(i, j)) });
      i = j; continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_.]/.test(s[j])) j++;
      tokens.push({ t: 'id', v: s.slice(i, j) });
      i = j; continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < s.length && s[j] !== ch) j++;
      tokens.push({ t: 'str', v: s.slice(i + 1, j) });
      i = j + 1; continue;
    }
    if ('+-*/(),'.includes(ch)) { tokens.push({ t: 'op', v: ch }); i++; continue; }
    throw new Error('Ukendt tegn i formel: ' + ch + ' i "' + src + '"');
  }
  return tokens;
}

export function parse(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const expect = (v) => { const t = next(); if (!t || t.v !== v) throw new Error('Forventede ' + v + ' i "' + src + '"'); };

  function expr() {
    let l = term();
    while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = next().v;
      l = { t: 'bin', op, l, r: term() };
    }
    return l;
  }
  function term() {
    let l = unary();
    while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/')) {
      const op = next().v;
      l = { t: 'bin', op, l, r: unary() };
    }
    return l;
  }
  function unary() {
    if (peek() && peek().t === 'op' && peek().v === '-') { next(); return { t: 'neg', x: unary() }; }
    if (peek() && peek().t === 'op' && peek().v === '+') { next(); return unary(); }
    return primary();
  }
  function primary() {
    const t = next();
    if (!t) throw new Error('Uventet slutning på formel: "' + src + '"');
    if (t.t === 'num') return { t: 'num', v: t.v };
    if (t.t === 'str') return { t: 'str', v: t.v };
    if (t.t === 'id') {
      if (peek() && peek().t === 'op' && peek().v === '(') {
        next();
        const args = [];
        if (!(peek() && peek().v === ')')) {
          args.push(expr());
          while (peek() && peek().v === ',') { next(); args.push(expr()); }
        }
        expect(')');
        return { t: 'call', fn: t.v.toUpperCase(), args };
      }
      return { t: 'ref', id: t.v };
    }
    if (t.t === 'op' && t.v === '(') { const e = expr(); expect(')'); return e; }
    throw new Error('Uventet symbol "' + t.v + '" i formel "' + src + '"');
  }
  const ast = expr();
  if (p < toks.length) throw new Error('Overskydende symboler i formel "' + src + '"');
  return ast;
}

const round = (x, n) => { const f = Math.pow(10, n || 0); return Math.round((x + Number.EPSILON) * f) / f; };

// ctx: { get(id), konto(nr), likvidInd(id), likvidUd(id) }
export function evaluate(ast, ctx) {
  switch (ast.t) {
    case 'num': return ast.v;
    case 'str': return ast.v;
    case 'ref': return ctx.get(ast.id);
    case 'neg': return -evaluate(ast.x, ctx);
    case 'bin': {
      const a = evaluate(ast.l, ctx), b = evaluate(ast.r, ctx);
      switch (ast.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return b === 0 ? 0 : a / b;
      }
      break;
    }
    case 'call': {
      const A = () => ast.args.map(a => evaluate(a, ctx));
      switch (ast.fn) {
        case 'SUM': return A().reduce((s, v) => s + (Number(v) || 0), 0);
        case 'ROUND': { const [x, n] = A(); return round(x, n); }
        case 'ABS': return Math.abs(A()[0]);
        case 'MIN': return Math.min(...A());
        case 'MAX': return Math.max(...A());
        case 'IFZERO': { const [x, alt] = A(); return x === 0 ? alt : x; }
        case 'SAFEDIV': { const [a, b] = A(); return b === 0 ? 0 : a / b; }
        case 'KONTO': return ctx.konto(evaluate(ast.args[0], ctx));
        case 'LIKVIDIND': return ctx.likvidInd(evaluate(ast.args[0], ctx));
        case 'LIKVIDUD': return ctx.likvidUd(evaluate(ast.args[0], ctx));
        case 'PLANRENTE': return ctx.plan(evaluate(ast.args[0], ctx), evaluate(ast.args[1], ctx), 'rente');
        case 'PLANAFDRAG': return ctx.plan(evaluate(ast.args[0], ctx), evaluate(ast.args[1], ctx), 'afdrag');
        case 'PLANAFDRAGAKK': return ctx.planAkk(evaluate(ast.args[0], ctx), evaluate(ast.args[1], ctx));
      }
      throw new Error('Ukendt funktion ' + ast.fn);
    }
  }
  throw new Error('Ugyldigt udtryk');
}

// Samler alle node-referencer i et udtryk
export function refs(ast, out = new Set()) {
  switch (ast.t) {
    case 'ref': out.add(ast.id); break;
    case 'neg': refs(ast.x, out); break;
    case 'bin': refs(ast.l, out); refs(ast.r, out); break;
    case 'call': ast.args.forEach(a => refs(a, out)); break;
  }
  return out;
}

// Oversættelse til Excel-formel.
// xctx: { ref(id) -> "Ark!C5", konto(nr) -> formel-streng, likvidInd(id), likvidUd(id) }
export function toExcel(ast, xctx) {
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2 };
  function go(n, parentPrec) {
    switch (n.t) {
      case 'num': return String(n.v);
      case 'str': return '"' + n.v + '"';
      case 'ref': return xctx.ref(n.id);
      case 'neg': return '-' + go(n.x, 3);
      case 'bin': {
        const s = go(n.l, prec[n.op]) + n.op + go(n.r, prec[n.op] + (n.op === '-' || n.op === '/' ? 1 : 0));
        return parentPrec > prec[n.op] ? '(' + s + ')' : s;
      }
      case 'call': {
        const args = n.args.map(a => go(a, 0));
        switch (n.fn) {
          case 'KONTO': return '(' + xctx.konto(n.args[0].v) + ')';
          case 'LIKVIDIND': return '(' + xctx.likvidInd(n.args[0].v) + ')';
          case 'LIKVIDUD': return '(' + xctx.likvidUd(n.args[0].v) + ')';
          case 'PLANRENTE': return '(' + xctx.plan(n.args[0].v, n.args[1].v, 'rente') + ')';
          case 'PLANAFDRAG': return '(' + xctx.plan(n.args[0].v, n.args[1].v, 'afdrag') + ')';
          case 'PLANAFDRAGAKK': return '(' + xctx.planAkk(n.args[0].v, n.args[1].v) + ')';
          case 'IFZERO': return 'IF((' + args[0] + ')=0,' + args[1] + ',' + args[0] + ')';
          case 'SAFEDIV': return 'IF((' + args[1] + ')=0,0,(' + args[0] + ')/(' + args[1] + '))';
          case 'SUM': return 'SUM(' + args.join(',') + ')';
          default: return n.fn + '(' + args.join(',') + ')';
        }
      }
    }
  }
  return go(ast, 0);
}

// Oversættelse til læselig tekst (labels i stedet for id'er).
// tctx: { label(id) -> string, konto(nr) -> string, likvidInd(id), likvidUd(id) }
export function toText(ast, tctx) {
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2 };
  function go(n, parentPrec) {
    switch (n.t) {
      case 'num': return String(n.v).replace('.', ',');
      case 'str': return '"' + n.v + '"';
      case 'ref': return '[' + tctx.label(n.id) + ']';
      case 'neg': return '−' + go(n.x, 3);
      case 'bin': {
        const sym = { '+': ' + ', '-': ' − ', '*': ' × ', '/': ' ÷ ' }[n.op];
        const s = go(n.l, prec[n.op]) + sym + go(n.r, prec[n.op] + (n.op === '-' || n.op === '/' ? 1 : 0));
        return parentPrec > prec[n.op] ? '(' + s + ')' : s;
      }
      case 'call': {
        const args = n.args.map(a => go(a, 0));
        switch (n.fn) {
          case 'KONTO': return tctx.konto(n.args[0].v);
          case 'LIKVIDIND': return tctx.likvidInd(n.args[0].v);
          case 'LIKVIDUD': return tctx.likvidUd(n.args[0].v);
          case 'PLANRENTE': return `Renter og bidrag ${n.args[1].v} iflg. betalingsplan`;
          case 'PLANAFDRAG': return `Afdrag ${n.args[1].v} iflg. betalingsplan`;
          case 'PLANAFDRAGAKK': return `Afdrag til og med ${n.args[1].v} iflg. betalingsplan`;
          case 'SUM': return 'SUM(' + args.join('; ') + ')';
          case 'ROUND': return 'AFRUND(' + args.join('; ') + ')';
          case 'SAFEDIV': return args[0] + ' ÷ ' + args[1];
          case 'IFZERO': return 'HVIS ' + args[0] + ' = 0 så ' + args[1] + ' ellers ' + args[0];
          default: return n.fn + '(' + args.join('; ') + ')';
        }
      }
    }
  }
  return go(ast, 0);
}
