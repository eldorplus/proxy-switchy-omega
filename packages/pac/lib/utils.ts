//import type { IOptions } from './options';
import { getDomain } from 'tldts';

/**
export const Revision = {
  fromTime: (time?: string): string => {
    ntime = time ? new Date(time) : new Date();
    return ntime.getTime().toString(16);
  },
  compare: (a?: string, b?: string): number => {
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    if (a.length > b.length) return 1;
    if (a.length < b.length) return -1;
    if (a > b) return 1;
    if (a < b) return -1;
    return 0;
  },
};

export class AttachedCache {
  private prop: string;
  private tag: (obj: any) => string;

  constructor(opt_prop: string, tag?: (obj: any) => string) {
    this.prop = opt_prop;
    if (typeof tag === 'undefined') {
      this.tag = opt_prop;
      this.prop = '_cache';
    } else {
      this.tag = tag;
    }
  }

  get(obj: any, otherwise: any): any {
    const tag = this.tag(obj);
    const cache = this._getCache(obj);
    if (cache && cache.tag === tag) {
      return cache.value;
    }
    const value = typeof otherwise === 'function' ? otherwise() : otherwise;
    this._setCache(obj, { tag: tag, value: value });
    return value;
  }

  drop(obj: any): void {
    if (obj[this.prop] !== undefined) {
      obj[this.prop] = undefined;
    }
  }

  private _getCache(obj: any): any {
    return obj[this.prop];
  }

  private _setCache(obj: any, value: any): void {
    if (!Object.prototype.hasOwnProperty.call(obj, this.prop)) {
      Object.defineProperty(obj, this.prop, { writable: true });
    }
    obj[this.prop] = value;
  }
}
**/

/**
 *
 * @param domain
 * @return boolean
 */
export const isIp = (domain: string): boolean => {
  if (domain.indexOf(':') > 0) return true; // IPv6
  const lastCharCode = domain.charCodeAt(domain.length - 1);
  if (48 <= lastCharCode && lastCharCode <= 57) return true; // IP address ending with number.
  return false;
};

/**
 *
 * @param domain
 * @return string
 */
export const getBaseDomain = (domain: string): string => {
  if (isIp(domain)) {
    return domain;
  }
  return getDomain(domain) || domain;
};

export const wildcardForDomain = (domain: string): string => {
  if (isIp(domain)) {
    return domain;
  }
  return `*.${getBaseDomain(domain)}`;
};

export const wildcardForUrl = (url: string): string => {
  const domain = new URL(url).hostname;

  return wildcardForDomain(domain);
};
