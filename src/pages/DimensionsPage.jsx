import { DIMENSIONS } from "../data/seed/dimensions";

export default function DimensionsPage() {
  return (
    <section>
      <div className="page-head">
        <div>
          <div className="page-title">Dimensions</div>
          <div className="page-sub">10 dimensions · applied to every transaction automatically</div>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary">+ Add dimension</button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Dimension</th>
              <th>Values</th>
              <th>Value count</th>
              <th>Transactions</th>
            </tr>
          </thead>
          <tbody>
            {DIMENSIONS.map((dimension, idx) => (
              <tr key={dimension.key}>
                <td>{dimension.label}</td>
                <td>
                  <div className="dim-values">
                    {dimension.values.map((value) => (
                      <span className="dim-val" key={value}>
                        {value}
                      </span>
                    ))}
                  </div>
                </td>
                <td>{dimension.values.length}</td>
                <td>{(18432 - idx * 1117).toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dim-info mt-12">
        <strong>How dimensions work.</strong> Every transaction is automatically tagged using these dimensions, and tags can be overridden manually on specific transactions.
      </div>
    </section>
  );
}
