const Promise = require('bluebird');
const _ = require('lodash');
const should = require('should'); // eslint-disable-line no-unused-vars
const queue = require('../index.js');
const queues = {};

/* eslint-disable no-unused-vars */
describe('Should test queue workflow', () => {
  before(createQueue);
  it('Should queue 25 expenses', queueExpenses);
  it('Should queue 78 invoices', queueInvoices);
  it('Should get and complete a single expense', getExpense);
  it('Should get and error a single expense', errorExpense);
  it('Should get two expenses concurrently without duplication', getWithoutDuplication);
  // it('Should text expense timeout', testTimeout);
});
/* eslint-enable no-unused-vars */

function createQueue() {
  queues.expenses = new queue.Queue('xero_expense', { timeout: 5000 });
  queues.invoices = new queue.Queue('xero_invoice', {});
}

function queueExpenses() {
  return Promise.map(_.times(25), n => queues.expenses.add({ expense: n }))
    .then(() => queues.expenses.count('Pending'))
    .then(count => {
      should.equal(count, 25);
    });
}

function queueInvoices() {
  return Promise.map(_.times(78), n => queues.invoices.add({ invoice: n }))
    .then(() => queues.invoices.count('Pending'))
    .then(count => {
      should.equal(count, 78);
    });
}

function getExpense() {
  let item;

  return queues.expenses.count()
    .then(count => {
      should.equal(count, 0);

      return queues.expenses.get();
    })
    .then(queueItem => item = queueItem)
    .then(() => queues.expenses.count())
    .then(count => {
      should.equal(count, 1);

      return queues.expenses.complete(item);
    })
    .then(() => queues.expenses.count())
    .then(count => {
      should.equal(count, 0);
    });
}

function errorExpense(done) {
  queue.config.onError = item => {
    should.exist(item);

    done();
  };

  queues.expenses.get()
    .then(item => {
      queues.expenses.error(item);
    });
}

function getWithoutDuplication() {
  return Promise.all([
      queues.expenses.get(),
      queues.expenses.get(),
      queues.expenses.get(),
      queues.expenses.get(),
      queues.expenses.get(),
      queues.expenses.get(),
      queues.expenses.get()
    ])
    .then(items => {
      const ids = _(items).map('id').uniq().value();

      should.equal(ids.length, 7, 'Should receive 7 unique ids');
    });
}

function textTimeout() {
  this.timeout(71000);
  let failures = 0;

  queue.config.onTimeout = () => {
    failures++;
  }

  return queues.expenses.get({ limit: 1000 })
    .then(result => Promise.map(_.initial(result), queues.expenses.complete))
    .delay(70000)
    .then(() => {
      should.equal(failures, 1, 'One item should have timed out!');
    });
}
