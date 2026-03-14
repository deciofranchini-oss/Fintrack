
import { STORE, subscribe } from "./store.js";

subscribe(state => {
  renderTransactions(state.transactions, state.accounts);
});

function computeRunningBalance(transactions, openingBalance){

  const sorted = [...transactions].sort(
    (a,b)=> new Date(a.date) - new Date(b.date)
  );

  let balance = openingBalance || 0;
  const map = {};

  for(const tx of sorted){

    const value = Number(tx.amount) || 0;

    balance = balance + value;

    map[tx.id] = balance;
  }

  return map;
}

function renderTransactions(transactions, accounts){

  const container = document.querySelector("#transactions-list");
  if(!container) return;

  container.innerHTML = "";

  let openingBalance = 0;

  if(accounts && accounts.length === 1){
    openingBalance = Number(accounts[0].opening_balance || 0);
  }

  const balances = computeRunningBalance(transactions, openingBalance);

  transactions.forEach(tx=>{

    const row = document.createElement("div");
    row.className = "tx-row";

    row.innerHTML = `
      <div class="tx-desc">
        <div class="tx-title">${tx.description || ""}</div>
        <div class="tx-category">${tx.category || ""}</div>
        <div class="tx-meta">${tx.payee || ""}</div>
      </div>
      <div class="tx-amount">${tx.amount}</div>
      <div class="tx-balance">${balances[tx.id] || 0}</div>
    `;

    container.appendChild(row);

  });
}
