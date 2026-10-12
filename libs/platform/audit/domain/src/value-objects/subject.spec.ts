import { Subject } from './subject';

describe('Subject', () => {
  it('from() acepta subjectType y subjectId no vacios', () => {
    const subject = Subject.from({ subjectType: 'Branch', subjectId: 'branch-1' });

    expect(subject.toSubjectType()).toBe('Branch');
    expect(subject.toSubjectId()).toBe('branch-1');
  });

  it('from() hace trim de ambos campos', () => {
    const subject = Subject.from({ subjectType: '  Company  ', subjectId: '  co-1  ' });

    expect(subject.toSubjectType()).toBe('Company');
    expect(subject.toSubjectId()).toBe('co-1');
  });

  it('from() rechaza subjectType vacio', () => {
    expect(() => Subject.from({ subjectType: '', subjectId: 'x' })).toThrow(TypeError);
  });

  it('from() rechaza subjectId vacio', () => {
    expect(() => Subject.from({ subjectType: 'Branch', subjectId: '   ' })).toThrow(TypeError);
  });
});
