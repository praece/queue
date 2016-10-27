const Promise = require('bluebird');
const _ = require('lodash');
const should = require('should'); // eslint-disable-line no-unused-vars
const Queue = require('../index.js');
const queues = {};

/* eslint-disable no-unused-vars */
describe('Should test queue workflow', () => {
  before(createQueue);
  it('Should queue 25 expenses', queueExpenses);
  it('Should queue 78 invoices', queueInvoices);
  it('Should get and complete a single expense', getExpense);
  it('Should queue and get a high priority and low priority expense', queueHighPriorityExpense);
  it('Should get two expenses concurrently without duplication', getWithoutDuplication);
  it('Should retry an expense', retry);
  it('Should text expense timeout', testTimeout);
});
/* eslint-enable no-unused-vars */

function createQueue() {
  queues.expenses = new Queue('xero_expense');
  queues.invoices = new Queue('xero_invoice');
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

function queueHighPriorityExpense() {
  return queues.expenses.add({ invoice: 'high priority' }, { priority: -1 })
    .then(() => queues.expenses.add({ invoice: 'low priority' }, { priority: 1 }))
    .then(() => queues.expenses.get())
    .then(item => {
      should.equal(item.meta.invoice, 'high priority');
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

function retry(done) {
  Queue.onError = (message, error) => {
    should.equal(message, 'Too many retry attempts');
    should.exist(error);
    done();
  };

  Promise.resolve()
    .then(() => queues.expenses.get())
    .tap(item => queues.expenses.retry(item, { newValue: 'test' }))
    .then(item => queues.expenses.get({ where: { id: item.id } }))
    .tap(item => {
      // We should be able to update the meta data on a retry
      should.equal(item.meta.newValue, 'test');
    })
    .tap(item => queues.expenses.retry(item))
    .then(item => queues.expenses.get({ where: { id: item.id } }))
    .tap(item => queues.expenses.retry(item));
}

function testTimeout() {
  return Promise.resolve()
    .then(() => queues.expenses.get({ timeout: -1000 }))
    .tap(() => Promise.all([
      Queue.checkTimeout(),
      Queue.checkTimeout(),
      Queue.checkTimeout(),
      Queue.checkTimeout(),
      Queue.checkTimeout(),
      Queue.checkTimeout()
    ]))
    .then(item => queues.expenses.get({ where: { id: item.id } }))
    .tap(item => {
      should.equal(item.attempt, 2);
    });
}
