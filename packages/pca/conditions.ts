import * as U2 from 'uglify-js';
import * as IP from 'ip-address';
import * as Url from 'url';
import { shExp2RegExp, escapeSlash } from './shexp_utils';
import { AttachedCache } from './utils';

declare interface Condition {
  conditionType: string;
  pattern?: string;
  days?: string;
  startDay?: number;
  endDay?: number;
  startHour?: number;
  endHour?: number;
  minValue?: number;
  maxValue?: number;
  ip?: string;
  prefixLength?: number;
}
declare interface Request {
  url: string;
  host: string;
  scheme: string;
}
declare interface Cache {
  analyzed: any;
  compiled?: any;
  host?: RegExp;
  ip?: any;
  scheme?: string;
  url?: RegExp;
  normalizedPattern?: string;
  addr?: any;
  normalized?: any;
  mask?: any;
}
interface Handler {
  analyze: (condition: Condition) => Cache;
  match: (condition: Condition, request: Request, cache: Cache) => boolean;
  compile: (condition: Condition, cache: Cache) => any;
  str?: (condition: Condition) => string;
  abbrs: string[];
  fromStr?: (str: string, condition: Condition) => Condition | null;
  tag?: (condition: Condition) => string;
}


export const colonCharCode: number = ':'.charCodeAt(0)
let _abbrs: Record<string, string> | null = {}
const ipv6Max = new IP.Address6('::/0').endAddress().canonicalForm()
const localHosts = ["127.0.0.1", "[::1]", "localhost"]

export const requestFromUrl = (url: string | Url.UrlWithStringQuery): Request => {
    if (typeof url === 'string') {
      url = Url.parse(url);
    }
    return {
      url: Url.format(url),
      host: url.hostname!,
      scheme: url.protocol!.replace(':', '')
    };
}

export const urlWildcard2HostWildcard = (pattern: string): string | undefined => {
  const result = pattern.match(/^\*:\/\/((?:\w|[?*._\-])+)\/\*$/);
  return result?.[1];
}

export const tag = (condition: Condition): string => _condCache.tag(condition);

export const analyze = (condition: Condition): Cache => _condCache.get(condition, () => ({
    analyzed: _handler(condition.conditionType).analyze.call(condition)
  }))

export const match = (condition: Condition, request: Request): boolean => {
    const cache = analyze(condition);
    return _handler(condition.conditionType).match.call(condition, request, cache);
}

export const compile = (condition: Condition): any => {
    const cache = analyze(condition);
    if (cache.compiled) return cache.compiled;
    const handler = _handler(condition.conditionType);
    cache.compiled = handler.compile.call(condition, cache)
    return cache.compiled;
}

export const str = (condition: Condition, options: { abbr?: number } = { abbr: -1 }): string => {
    const handler = _handler(condition.conditionType);
    if (handler.abbrs[0].length === 0) {
      const endCode = condition.pattern!.charCodeAt(condition.pattern!.length - 1);
      if (endCode !== colonCharCode && condition.pattern!.indexOf(' ') < 0) {
        return condition.pattern!;
      }
    }
    const str = handler.str;
    const typeStr = typeof options.abbr === 'number'
      ? handler.abbrs[(handler.abbrs.length + options.abbr) % handler.abbrs.length]
      : condition.conditionType;
    let result = typeStr + ':';
    const part = str ? str.call(condition) : condition.pattern;
    if (part) result += ' ' + part;
    return result;
}

export const fromStr = (str: string): Condition | null => {
    str = str.trim();
    let i = str.indexOf(' ');
    if (i < 0) i = str.length;
    let conditionType = '';
    if (str.charCodeAt(i - 1) === colonCharCode) {
      conditionType = str.substr(0, i - 1);
      str = str.substr(i + 1).trim();
    }

    conditionType = typeFromAbbr(conditionType);
    if (!conditionType) return null;
    const condition: Condition = { conditionType };
    const fromStr = _handler(condition.conditionType).fromStr;
    if (fromStr) {
      return fromStr.call(str, condition);
    } else {
      condition.pattern = str;
      return condition;
    }
}

export const typeFromAbbr = (abbr: string): string | undefined => {
    if (!_abbrs) {
      _abbrs = {};
      for (const [type, { abbrs }] of Object.entries(_conditionTypes)) {
        _abbrs[type.toUpperCase()] = type;
        for (const ab of abbrs) {
          _abbrs[ab.toUpperCase()] = type;
        }
      }
    }

    return _abbrs[abbr.toUpperCase()];
}

export const Comment = (comment: string | undefined, node): any => {
    if (!comment) return node;
    node.start = node.start || {};
    Object.defineProperty(node.start, '_comments_dumped', {
      get: () => false,
      set: () => {}
    });
    node.start.comments_before = node.start.comments_before || [];
    node.start.comments_before.push({ type: 'comment2', value: comment });
    return node;
  }

export const safeRegex = (expr: string): RegExp => {
    try {
      return new RegExp(expr);
    } catch (_) {
      //  return null;
      return /(?!)/;
    }
  }

export const regTest = (expr: string | U2.AST_Node, regexp: string | RegExp): U2.AST_Call => {
    if (typeof regexp === 'string') {
      regexp = regexSafe(escapeSlash(regexp));
    }
    if (typeof expr === 'string') {
      expr = new U2.AST_SymbolRef({ name: expr });
    }
    return new U2.AST_Call({
      args: [expr],
      expression: new U2.AST_Dot({
        property: 'test',
        expression: new U2.AST_RegExp({ value: regexp })
      })
    });
}

/**
export const regTest = (property: string, regex: RegExp) => {
    return new U2.AST_Call({
      expression: new U2.AST_Dot({
        expression: new U2.AST_SymbolRef({ name: property }),
        property: 'test'
      }),
      args: [new U2.AST_RegExp({ value: regex.source })]
    });
};
**/

export const isInt = (num: number): boolean => {
    return (typeof num === 'number' && !isNaN(num) &&
      parseFloat(num.toString()) === parseInt(num.toString(), 10));
};

export const between = (val: U2.AST_Node, min: number | U2.AST_Node, max: number | U2.AST_Node, comment?: string): U2.AST_Node => {
    if (min === max) {
      if (typeof min === 'number') {
        min = new U2.AST_Number({ value: min });
      }
      return Comment(comment, new U2.AST_Binary({
        left: val,
        operator: '===',
        right: min
      }));
    }
    if (min > max) {
      return Comment(comment, new U2.AST_False());
    }
    if (isInt(min as number) && isInt(max as number) && (max as number) - (min as number) < 32) {
      comment = comment || `${min} <= value && value <= ${max}`;
      const tmpl = "0123456789abcdefghijklmnopqrstuvwxyz";
      const str =
        (max as number) < tmpl.length
          ? tmpl.substr(min as number, (max as number) - (min as number) + 1)
          : tmpl.substr(0, (max as number) - (min as number) + 1);
      const pos = (min as number) === 0 ? val :
        new U2.AST_Binary({
          left: val,
          operator: '-',
          right: new U2.AST_Number({ value: min as number })
        });
      return Comment(comment, new U2.AST_Binary({
        left: new U2.AST_Call({
          expression: new U2.AST_Dot({
            expression: new U2.AST_String({ value: str }),
            property: 'charCodeAt'
          }),
          args: [pos]
        }),
        operator: '>',
        right: new U2.AST_Number({ value: 0 })
      }));
    }
    if (typeof min === 'number') {
      min = new U2.AST_Number({ value: min });
    }
    if (typeof max === 'number') {
      max = new U2.AST_Number({ value: max });
    }
    return Comment(comment, new U2.AST_Call({
      args: [val, min, max],
      expression: new U2.AST_Function({
        argnames: [
          new U2.AST_SymbolFunarg({ name: 'value' }),
          new U2.AST_SymbolFunarg({ name: 'min' }),
          new U2.AST_SymbolFunarg({ name: 'max' })
        ],
        body: [
          new U2.AST_Return({
            value: new U2.AST_Binary({
              left: new U2.AST_Binary({
                left: new U2.AST_SymbolRef({ name: 'min' }),
                operator: '<=',
                right: new U2.AST_SymbolRef({ name: 'value' })
              }),
              operator: '&&',
              right: new U2.AST_Binary({
                left: new U2.AST_SymbolRef({ name: 'value' }),
                operator: '<=',
                right: new U2.AST_SymbolRef({ name: 'max' })
              })
            })
          })
        ]
      })
    }));
};

export const parseIp = (ip: string): IP.Address4 | IP.Address6 | null => {
    if (ip.charCodeAt(0) === '['.charCodeAt(0)) {
      ip = ip.substr(1, ip.length - 2);
    }
    let addr = new IP.Address4(ip);
    if (!addr.isValid()) {
      addr = new IP.Address6(ip);
      if (!addr.isValid()) {
        return null;
      }
    }
    return addr;
};

export const normalizeIp = (addr: IP.Address4 | IP.Address6): string => {
  return (addr.correctForm || addr.canonicalForm).call(addr);
};

export const getWeekdayList = (condition: Condition): boolean[] => {
  if (condition.days) {
    return Array.from({ length: 7 }, (_, i) => condition.days!.charCodeAt(i) > 64);
  } else {
    return Array.from({ length: 7 }, (_, i) => condition.startDay! <= i && i <= condition.endDay!);
  }
};

const _condCache = new AttachedCache<Condition, Cache>((condition: Condition) => {
    const tag = _handler(condition.conditionType).tag;
    const result = tag ? tag.apply([condition]) : str(condition);
    return condition.conditionType + '$' + result;
});

const _setProp = (obj: any, prop: string, value: any): void => {
    if (!Object.prototype.hasOwnProperty.call(obj, prop)) {
      Object.defineProperty(obj, prop, { writable: true });
    }
    obj[prop] = value;
};

const _handler = (conditionType: string | Condition): Handler => {
    if (typeof conditionType !== 'string') {
      conditionType = conditionType.conditionType;
    }
    const handler = _conditionTypes[conditionType];

    if (!handler) {
      throw new Error(`Unknown condition type: ${conditionType}`);
    }
    return handler;
};

const _conditionTypes: Record<string, Handler> = {
    TrueCondition: {
      abbrs: ['True'],
      analyze: (condition: Condition) => null,
      match: () => true,
      compile: (condition: Condition) => new U2.AST_True(),
      str: (condition: Condition) => '',
      fromStr: (str: string, condition: Condition) => condition,
    },

    FalseCondition: {
      abbrs: ['False', 'Disabled'],
      analyze: (condition: Condition) => null,
      match: () => false,
      compile: (condition: Condition) => new U2.AST_False(),
      fromStr: (str: string, condition: Condition) => {
        if (str.length > 0) {
          condition.pattern = str;
        }
        return condition;
      },
    },

    UrlRegexCondition: {
      abbrs: ['UR', 'URegex', 'UrlR', 'UrlRegex'],
      analyze: (condition: Condition) => safeRegex(escapeSlash(condition.pattern)),
      match: (condition: Condition, request: Request, cache: Cache) => {
        return cache.analyzed.test(request.url);
      },
      compile: (condition: Condition, cache: Cache) => {
        return regTest('url', cache.analyzed);
      },
    },

    UrlWildcardCondition: {
      abbrs: ['U', 'UW', 'Url', 'UrlW', 'UWild', 'UWildcard', 'UrlWild', 'UrlWildcard'],
      analyze: (condition: Condition) => {
        const parts = condition.pattern.split('|').filter(pattern => pattern).map(pattern =>
          shExp2RegExp(pattern, { trimAsterisk: true })
        );
        return safeRegex(parts.join('|'));
      },
      match: (condition: Condition, request: Request, cache: Cache) => {
        return cache.analyzed.test(request.url);
      },
      compile: (condition: Condition, cache: Cache) => {
        return regTest('url', cache.analyzed);
      },
    },

    HostRegexCondition: {
      abbrs: ['R', 'HR', 'Regex', 'HostR', 'HRegex', 'HostRegex'],
      analyze: (condition: Condition) => safeRegex(escapeSlash(condition.pattern)),
      match: (condition: Condition, request: Request, cache: Cache) => {
        return cache.analyzed.test(request.host);
      },
      compile: (condition: Condition, cache: Cache) => {
        return regTest('host', cache.analyzed);
      },
    },

    HostWildcardCondition: {
      abbrs: ['', 'H', 'W', 'HW', 'Wild', 'Wildcard', 'Host', 'HostW', 'HWild', 'HWildcard', 'HostWild', 'HostWildcard'],
      analyze: (condition: Condition) => {
        const parts = condition.pattern.split('|').filter(pattern => pattern).map(pattern => {
          if (pattern.charCodeAt(0) === '.'.charCodeAt(0)) {
            pattern = '*' + pattern;
          }

          if (pattern.indexOf('**.') === 0) {
            return shExp2RegExp(pattern.substring(1), { trimAsterisk: true });
          } else if (pattern.indexOf('*.') === 0) {
            return shExp2RegExp(pattern.substring(2), { trimAsterisk: false })
              .replace(/./, '(?:^|\\.)')
              .replace(/\.\*\$$/, '');
          } else {
            return shExp2RegExp(pattern, { trimAsterisk: true });
          }
        });
        return safeRegex(parts.join('|'));
      },
      match: (condition: Condition, request: Request, cache: Cache) => {
        return cache.analyzed.test(request.host);
      },
      compile: (condition: Condition, cache: Cache) => {
        return regTest('host', cache.analyzed);
      },
    },

    BypassCondition: {
      abbrs: ['B', 'Bypass'],
      analyze: (condition: Condition): Cache => {
        const cache: Cache = {
          host: null,
          ip: null,
          scheme: null,
          url: null,
          normalizedPattern: ''
        };
        let server = condition.pattern;
        if (server === '<local>') {
          cache.host = server;
          return cache;
        }
        const parts = server.split('://');
        if (parts.length > 1) {
          cache.scheme = parts[0];
          cache.normalizedPattern = cache.scheme + '://';
          server = parts[1];
        }

        const addrParts = server.split('/');
        if (addrParts.length > 1) {
          const addr = parseIp(addrParts[0]);
          const prefixLen = parseInt(addrParts[1], 10);
          if (addr && !isNaN(prefixLen)) {
            cache.ip = {
              conditionType: 'IpCondition',
              ip: normalizeIp(addr),
              prefixLength: prefixLen
            };
            cache.normalizedPattern += cache.ip.ip + '/' + cache.ip.prefixLength;
            return cache;
          }
        }

        let serverIp = parseIp(server);
        if (!serverIp) {
          const pos = server.lastIndexOf(':');
          if (pos >= 0) {
            const matchPort = server.substring(pos + 1);
            server = server.substring(0, pos);
          }
          serverIp = parseIp(server);
        }
        if (serverIp) {
          server = normalizeIp(serverIp);
          if (serverIp.v4) {
            cache.normalizedPattern += server;
          } else {
            cache.normalizedPattern += '[' + server + ']';
          }
        } else {
          if (server.charCodeAt(0) === '.'.charCodeAt(0)) {
            server = '*' + server;
          }
          cache.normalizedPattern = server;
        }

        if (matchPort) {
          cache.port = matchPort;
          cache.normalizedPattern += ':' + cache.port;
          if (serverIp && !serverIp.v4) {
            server = '[' + server + ']';
          }
          const serverRegex = shExp2RegExp(server);
          const scheme = cache.scheme ? '[^:]+' : '';
          cache.url = safeRegex('^' + scheme + ':\\/\\/' + serverRegex + ':' + matchPort + '\\/');
        } else if (server !== '*') {
          const serverRegex = shExp2RegExp(server, { trimAsterisk: true });
          cache.host = safeRegex(serverRegex);
        }
        return cache;
      },
      match: (condition: Condition, request: Request, cache: Cache): boolean => {
        cache = cache.analyzed;
        if (cache.scheme && cache.scheme !== request.scheme) {
          return false;
        }
        if (cache.ip && !match(cache.ip, request)) {
          return false;
        }
        if (cache.host) {
          if (cache.host === '<local>') {
            return (
              request.host === '127.0.0.1' ||
              request.host === '::1' ||
              request.host.indexOf('.') < 0
            );
          } else {
            if (!cache.host.test(request.host)) {
              return false;
            }
          }
        }
        return !(cache.url && !cache.url.test(request.url));
      },
      str: (condition: Condition): string => {
        const analyze = _handler(condition).analyze;
        const cache = analyze.call(condition);
        if (cache.normalizedPattern) {
          return cache.normalizedPattern;
        } else {
          return condition.pattern;
        }
      },
      compile: (condition: Condition, cache: Cache) => {
        cache = cache.analyzed;
        if (cache.url) {
          return regTest('url', cache.url);
        }
        const conditions = [];
        if (cache.host === '<local>') {
          const hostEquals = (host: string) => new U2.AST_Binary({
            left: new U2.AST_SymbolRef({ name: 'host' }),
            operator: '===',
            right: new U2.AST_String({ value: host })
          });
          return new U2.AST_Binary({
            left: new U2.AST_Binary({
              left: hostEquals('127.0.0.1'),
              operator: '||',
              right: hostEquals('::1')
            }),
            operator: '||',
            right: new U2.AST_Binary({
              left: new U2.AST_Call({
                expression: new U2.AST_Dot({
                  expression: new U2.AST_SymbolRef({ name: 'host' }),
                  property: 'indexOf'
                }),
                args: [new U2.AST_String({ value: '.' })]
              }),
              operator: '<',
              right: new U2.AST_Number({ value: 0 })
            })
          });
        }
        if (cache.scheme) {
          conditions.push(new U2.AST_Binary({
            left: new U2.AST_SymbolRef({ name: 'scheme' }),
            operator: '===',
            right: new U2.AST_String({ value: cache.scheme })
          }));
        }
        if (cache.host) {
          conditions.push(regTest('host', cache.host));
        } else if (cache.ip) {
          conditions.push(compile(cache.ip));
        }
        switch (conditions.length) {
          case 0: return new U2.AST_True();
          case 1: return conditions[0];
          case 2: return new U2.AST_Binary({
            left: conditions[0],
            operator: '&&',
            right: conditions[1]
          });
        }
      },
    },

    KeywordCondition: {
      abbrs: ['K', 'KW', 'Keyword'],
      analyze: (condition: Condition) => null,
      match: (condition: Condition, request: Request) => {
        return request.scheme === 'http' && request.url.indexOf(condition.pattern) >= 0;
      },
      compile: (condition: Condition) => {
        return new U2.AST_Binary({
          left: new U2.AST_Binary({
            left: new U2.AST_SymbolRef({ name: 'scheme' }),
            operator: '===',
            right: new U2.AST_String({ value: 'http' })
          }),
          operator: '&&',
          right: new U2.AST_Binary({
            left: new U2.AST_Call({
              expression: new U2.AST_Dot({
                expression: new U2.AST_SymbolRef({ name: 'url' }),
                property: 'indexOf'
              }),
              args: [new U2.AST_String({ value: condition.pattern })]
            }),
            operator: '>=',
            right: new U2.AST_Number({ value: 0 })
          })
        });
      },
    },

    IpCondition: {
      abbrs: ['Ip'],
      analyze: (condition: Condition) => {
        const cache: Cache = {
          addr: null,
          normalized: null
        };
        let ip = condition.ip;
        if (ip.charCodeAt(0) === '['.charCodeAt(0)) {
          ip = ip.substr(1, ip.length - 2);
        }
        const addr = ip + '/' + condition.prefixLength;
        cache.addr = parseIp(addr);
        if (!cache.addr) {
          throw new Error(`Invalid IP address ${addr}`);
        }
        cache.normalized = normalizeIp(cache.addr);
        const mask = cache.addr.v4
          ? new IP.v4.Address('255.255.255.255/' + cache.addr.subnetMask)
          : new IP.v6.Address(ipv6Max + '/' + cache.addr.subnetMask);
        cache.mask = normalizeIp(mask.startAddress);
        return cache;
      },
      match: (condition: Condition, request: Request, cache: Cache) => {
        const addr = parseIp(request.host);
        if (!addr) {
          return false;
        }
        cache = cache.analyzed;
        if (addr.v4 !== cache.addr.v4) {
          return false;
        }
        return addr.isInSubnet(cache.addr);
      },
      compile: (condition: Condition, cache: Cache) => {
        cache = cache.analyzed;
        const hostLooksLikeIp = cache.addr.v4
          ? new U2.AST_Binary({
            left: new U2.AST_Sub({
              expression: new U2.AST_SymbolRef({ name: 'host' }),
              property: new U2.AST_Binary({
                left: new U2.AST_Dot({
                  expression: new U2.AST_SymbolRef({ name: 'host' }),
                  property: 'length'
                }),
                operator: '-',
                right: new U2.AST_Number({ value: 1 })
              })
            }),
            operator: '>=',
            right: new U2.AST_Number({ value: 0 })
          })
          : new U2.AST_Binary({
            left: new U2.AST_Call({
              expression: new U2.AST_Dot({
                expression: new U2.AST_SymbolRef({ name: 'host' }),
                property: 'indexOf'
              }),
              args: [new U2.AST_String({ value: ':' })]
            }),
            operator: '>=',
            right: new U2.AST_Number({ value: 0 })
          });

        if (cache.addr.subnetMask === 0) {
          return hostLooksLikeIp;
        }

        const hostIsInNet = new U2.AST_Call({
          expression: new U2.AST_SymbolRef({ name: 'isInNet' }),
          args: [
            new U2.AST_SymbolRef({ name: 'host' }),
            new U2.AST_String({ value: cache.normalized }),
            new U2.AST_String({ value: cache.mask })
          ]
        });

        if (!cache.addr.v4) {
          const hostIsInNetEx = new U2.AST_Call({
            expression: new U2.AST_SymbolRef({ name: 'isInNetEx' }),
            args: [
              new U2.AST_SymbolRef({ name: 'host' }),
              new U2.AST_String({ value: cache.normalized + cache.addr.subnet })
            ]
          });

          return new U2.AST_Binary({
            left: hostLooksLikeIp,
            operator: '&&',
            right: new U2.AST_Conditional({
              condition: new U2.AST_Binary({
                left: new U2.AST_UnaryPrefix({
                  operator: 'typeof',
                  expression: new U2.AST_SymbolRef({ name: 'isInNetEx' })
                }),
                operator: '===',
                right: new U2.AST_String({ value: 'function' })
              }),
              consequent: hostIsInNetEx,
              alternative: hostIsInNet
            })
          });
        }

        return new U2.AST_Binary({
          left: hostLooksLikeIp,
          operator: '&&',
          right: hostIsInNet
        });
      },
      str: (condition: Condition) => condition.ip + '/' + condition.prefixLength,
      fromStr: (str: string, condition: Condition) => {
        const addr = parseIp(str);
        if (addr) {
          condition.ip = addr.addressMinusSuffix;
          condition.prefixLength = addr.subnetMask;
        } else {
          condition.ip = '0.0.0.0';
          condition.prefixLength = 0;
        }
        return condition;
      },
    },

    HostLevelsCondition: {
      abbrs: ['Lv', 'Level', 'Levels', 'HL', 'HLv', 'HLevel', 'HLevels', 'HostL', 'HostLv', 'HostLevel', 'HostLevels'],
      analyze: (condition: Condition) => '.'.charCodeAt(0),
      match: (condition: Condition, request: Request, cache: Cache) => {
        const dotCharCode = cache.analyzed;
        let dotCount = 0;
        for (let i = 0; i < request.host.length; i++) {
          if (request.host.charCodeAt(i) === dotCharCode) {
            dotCount++;
            if (dotCount > condition.maxValue) {
              return false;
            }
          }
        }
        return dotCount >= condition.minValue;
      },
      compile: (condition: Condition) => {
        const val = new U2.AST_Dot({
          property: 'length',
          expression: new U2.AST_Call({
            args: [new U2.AST_String({ value: '.' })],
            expression: new U2.AST_Dot({
              expression: new U2.AST_SymbolRef({ name: 'host' }),
              property: 'split'
            })
          })
        });
        return between(val, condition.minValue + 1, condition.maxValue + 1,
          `${condition.minValue} <= hostLevels <= ${condition.maxValue}`);
      },
      str: (condition: Condition) => condition.minValue + '~' + condition.maxValue,
      fromStr: (str: string, condition: Condition) => {
        const [minValue, maxValue] = str.split('~');
        condition.minValue = parseInt(minValue, 10);
        condition.maxValue = parseInt(maxValue, 10);
        condition.minValue = condition.minValue > 0 ? condition.minValue : 1;
        condition.maxValue = condition.maxValue > 0 ? condition.maxValue : 1;
        return condition;
      },
    },

    WeekdayCondition: {
      abbrs: ['WD', 'Week', 'Day', 'Weekday'],
      analyze: (condition: Condition) => null,
      match: (condition: Condition, request: Request) => {
        const day = new Date().getDay();
        if (condition.days) {
          return condition.days.charCodeAt(day) > 64;
        }
        return condition.startDay <= day && day <= condition.endDay;
      },
      compile: (condition: Condition) => {
        const getDay = new U2.AST_Call({
          args: [],
          expression: new U2.AST_Dot({
            property: 'getDay',
            expression: new U2.AST_New({
              args: [],
              expression: new U2.AST_SymbolRef({ name: 'Date' })
            })
          })
        });

        if (condition.days) {
          return new U2.AST_Binary({
            left: new U2.AST_Call({
              expression: new U2.AST_Dot({
                expression: new U2.AST_String({ value: condition.days }),
                property: 'charCodeAt'
              }),
              args: [getDay]
            }),
            operator: '>',
            right: new U2.AST_Number({ value: 64 })
          });
        } else {
          return between(getDay, condition.startDay, condition.endDay);
        }
      },
      str: (condition: Condition) => {
        if (condition.days) {
          return condition.days;
        } else {
          return condition.startDay + '~' + condition.endDay;
        }
      },
      fromStr: (str: string, condition: Condition) => {
        if (str.indexOf('~') < 0 && str.length === 7) {
          condition.days = str;
        } else {
          const [startDay, endDay] = str.split('~');
          condition.startDay = parseInt(startDay, 10);
          condition.endDay = parseInt(endDay, 10);
          condition.startDay = condition.startDay >= 0 && condition.startDay <= 6 ? condition.startDay : 0;
          condition.endDay = condition.endDay >= 0 && condition.endDay <= 6 ? condition.endDay : 0;
        }
        return condition;
      },
    },

    TimeCondition: {
      abbrs: ['T', 'Time', 'Hour'],
      analyze: (condition: Condition) => null,
      match: (condition: Condition, request: Request) => {
        const hour = new Date().getHours();
        return condition.startHour <= hour && hour <= condition.endHour;
      },
      compile: (condition: Condition) => {
        const val = new U2.AST_Call({
          args: [],
          expression: new U2.AST_Dot({
            property: 'getHours',
            expression: new U2.AST_New({
              args: [],
              expression: new U2.AST_SymbolRef({ name: 'Date' })
            })
          })
        });
        return between(val, condition.startHour, condition.endHour);
      },
      str: (condition: Condition) => condition.startHour + '~' + condition.endHour,
      fromStr: (str: string, condition: Condition) => {
        const [startHour, endHour] = str.split('~');
        condition.startHour = parseInt(startHour, 10);
        condition.endHour = parseInt(endHour, 10);
        condition.startHour = condition.startHour >= 0 && condition.startHour < 24 ? condition.startHour : 0;
        condition.endHour = condition.endHour >= 0 && condition.endHour < 24 ? condition.endHour : 0;
        return condition;
      },
    },
};

