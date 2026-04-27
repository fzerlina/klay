import { getAccountGroups, getAccountRows } from "../data/klayData";

export default function ChartOfAccountsPage() {
  const accountRows = getAccountRows();
  const accountGroups = getAccountGroups();

  const statementLabel = (fs) => (fs === "BS" ? "Balance Sheet" : "P&L");

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="page-title">Chart of accounts</div>
          <div className="page-sub">
            {accountRows.length} accounts · {accountGroups.length} account groups
          </div>
        </div>
        <div className="head-actions">
          <button className="btn">Import CSV</button>
          <button className="btn btn-primary">+ Add account</button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Account name</th>
              <th>Statement</th>
              <th>Line item</th>
              <th>Section</th>
            </tr>
          </thead>
          <tbody>
            {accountRows.map((account) => (
              <tr key={account.id}>
                <td className="mono">{account.code}</td>
                <td>{account.name}</td>
                <td>{statementLabel(account.fs)}</td>
                <td>{account.type}</td>
                <td>{account.sec}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
