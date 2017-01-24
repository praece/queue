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
  it('Should find a single expense', findExpense);
  it('Queue and get an invoice that depends on an expense', invoiceDependsOnExpense);
  it('Should queue and get a high priority and low priority expense', queueHighPriorityExpense);
  it('Should get two expenses concurrently without duplication', getWithoutDuplication);
  it('Should retry an expense', retry);
  it('Should text expense timeout', testTimeout);
  it('Should test canceling an item with a dependent', testCancel);
  it('Should test purging the queue', testPurge);
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

function findExpense() {
  const options = {
    where: function() {
      this.where('meta', '@>', JSON.stringify({ expense: 5 }));
    }
  };

  return queues.expenses.find(options)
    .then(expense => {
      should.exist(expense.status);
      should.equal(expense.meta.expense, 5);
    });
}

function invoiceDependsOnExpense() {
  let expense;

  return queues.expenses.get()
    .then(expenseItem => {
      expense = expenseItem;
      return queues.invoices.add({ expense: expense.meta.expense }, { dependsOn: expense.id });
    })
    .then(() => {
      return queues.invoices.get({ 
        where: function() {
          this.where('meta', '@>', JSON.stringify({ expense: expense.meta.expense }));
        }
      });
    })
    .then(invoice => {
      should.equal(invoice.length, 0);

      return queues.expenses.complete(expense);
    })
    .then(() => {
      return queues.invoices.get({ 
        where: function() {
          this.where('meta', '@>', JSON.stringify({ expense: expense.meta.expense }));
        }
      });
    })
    .then(invoice => {
      should.exist(invoice);
      should.equal(invoice.meta.expense, expense.meta.expense);
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

function testCancel() {
  const ids = {};

  return Promise.resolve()
    .then(() => queues.expenses.add({ invoice: 'depended on' }))
    .tap(parent => { ids.parent = parent[0]; })
    .then(() => queues.expenses.add({ invoice: 'dependent' }, { dependsOn: ids.parent }))
    .tap(child => { ids.child = child[0]; })
    .tap(() => queues.expenses.cancel({ id: ids.parent }))
    .then(() => queues.expenses.add({ invoice: 'later' }, { dependsOn: ids.parent }))
    .tap(later => { ids.later = later[0]; })
    .tap(Queue.checkDependents)
    .then(() => {
      const where = [ids.parent, ids.child, ids.later];
      return queues.expenses.find({ limit: 3, where: q => q.whereIn('id', where) });
    })
    .then(items => {
      _.forEach(items, item => {
        should.equal(item.status, 'Canceled');
      });
    });
}

function testPurge() {
  const where = q => q.whereIn('status', ['Complete', 'Canceled']);
  const find = { limit: 1000, where };

  return Promise.resolve()
    .then(() => queues.expenses.find(find))
    .then(items => {
      items.length.should.be.above(0);
    })
    .tap(Queue.checkDependents)
    .then(() => queues.expenses.find(find))
    .then(items => {
      items.length.should.be.above(0);

      Queue.config.purgeInterval = 0;
    })
    .tap(Queue.purgeQueue)
    .then(() => queues.expenses.find(find))
    .then(items => {
      should.equal(items.length, 0);
    });
}
