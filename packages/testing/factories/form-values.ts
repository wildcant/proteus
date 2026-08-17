import { faker } from '@faker-js/faker'

export function generateLoginFormValues() {
  return {
    email: faker.internet.email(),
    password: faker.internet.password({ length: 12 }),
  }
}

export function generateRegisterFormValues() {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    password: faker.internet.password({ length: 12 }),
  }
}
