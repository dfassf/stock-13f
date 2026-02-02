import { describe, it, expect } from 'vitest';
import { AppError, ValidationError, SECAPIError, TimeoutError, ErrorCode } from '../app.error';

describe('AppError', () => {
  it('기본 에러를 생성해야 함', () => {
    const error = new AppError(ErrorCode.INTERNAL_ERROR, '테스트 에러');
    expect(error.message).toBe('테스트 에러');
    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('AppError');
  });

  it('커스텀 상태 코드를 설정해야 함', () => {
    const error = new AppError(ErrorCode.INTERNAL_ERROR, '테스트', 404);
    expect(error.statusCode).toBe(404);
  });

  it('원본 에러를 포함해야 함', () => {
    const originalError = new Error('원본 에러');
    const error = new AppError(ErrorCode.INTERNAL_ERROR, '래핑된 에러', 500, originalError);
    expect(error.originalError).toBe(originalError);
  });
});

describe('ValidationError', () => {
  it('검증 에러를 생성해야 함', () => {
    const error = new ValidationError('잘못된 입력');
    expect(error.message).toBe('잘못된 입력');
    expect(error.code).toBe(ErrorCode.INVALID_SOURCE);
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('ValidationError');
  });
});

describe('SECAPIError', () => {
  it('SEC API 에러를 생성해야 함', () => {
    const error = new SECAPIError('API 요청 실패');
    expect(error.message).toBe('API 요청 실패');
    expect(error.code).toBe(ErrorCode.SEC_API_ERROR);
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('SECAPIError');
  });
});

describe('TimeoutError', () => {
  it('타임아웃 에러를 생성해야 함', () => {
    const error = new TimeoutError('요청 시간 초과');
    expect(error.message).toBe('요청 시간 초과');
    expect(error.code).toBe(ErrorCode.TIMEOUT_ERROR);
    expect(error.statusCode).toBe(504);
    expect(error.name).toBe('TimeoutError');
  });
});
