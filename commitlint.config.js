export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat',
      'fix',
      'docs',
      'style',
      'refactor',
      'perf',
      'test',
      'build',
      'ci',
      'chore',
      'revert',
    ]],
    'scope-enum': [1, 'always', [
      'project', 'farm', 'member', 'finance', 'treasury', 'role', 'sidebar', 'build', 'db', 'api', 'ui'
    ]],
    'subject-case': [0],
    'body-max-line-length': [0],
  },
};
