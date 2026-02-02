import { describe, it, expect } from 'vitest';
import { isString, isNumber, isArray, parseNumber, safeParseInt } from '../type-guards';

describe('type-guards', () => {
  describe('isString', () => {
    it('문자열을 올바르게 식별해야 함', () => {
      expect(isString('test')).toBe(true);
      expect(isString('')).toBe(true);
      expect(isString(123)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('숫자를 올바르게 식별해야 함', () => {
      expect(isNumber(123)).toBe(true);
      expect(isNumber(0)).toBe(true);
      expect(isNumber(NaN)).toBe(false);
      expect(isNumber('123')).toBe(false);
      expect(isNumber(null)).toBe(false);
    });
  });

  describe('isArray', () => {
    it('배열을 올바르게 식별해야 함', () => {
      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray([])).toBe(true);
      expect(isArray('test')).toBe(false);
      expect(isArray(null)).toBe(false);
    });
  });

  describe('parseNumber', () => {
    it('문자열 숫자를 파싱해야 함', () => {
      expect(parseNumber('123')).toBe(123);
      expect(parseNumber('0')).toBe(0);
      expect(parseNumber('')).toBe(0);
      expect(parseNumber(undefined)).toBe(0);
    });

    it('숫자를 그대로 반환해야 함', () => {
      expect(parseNumber(123)).toBe(123);
      expect(parseNumber(0)).toBe(0);
    });

    it('기본값을 사용해야 함', () => {
      expect(parseNumber('invalid', 999)).toBe(999);
      expect(parseNumber(NaN, 999)).toBe(999);
    });
  });

  describe('safeParseInt', () => {
    it('안전하게 정수로 파싱해야 함', () => {
      expect(safeParseInt('123')).toBe(123);
      expect(safeParseInt(123)).toBe(123);
      expect(safeParseInt('0')).toBe(0);
      expect(safeParseInt(undefined, 999)).toBe(999);
      expect(safeParseInt('invalid', 999)).toBe(999);
    });
  });
});
