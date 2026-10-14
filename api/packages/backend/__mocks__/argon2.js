const argon2 = {
  hash: jest.fn().mockResolvedValue('hashed-password'),
  verify: jest.fn().mockResolvedValue(true),
  argon2id: 2,
};

module.exports = argon2;
