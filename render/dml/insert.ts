import * as safety from "../../lib/universal/safety.ts";
import * as r from "../../lib/universal/record.ts";
import * as tmpl from "../emit/sql.ts";
import * as d from "../domain/mod.ts";
import * as ns from "../emit/namespace.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

export type InsertStmtReturning<
  ReturnableRecord,
  ReturnableColumnName extends keyof ReturnableRecord = keyof ReturnableRecord,
  ReturnableColumnExpr extends string = string,
> =
  | "*"
  | "primary-keys"
  | safety.RequireOnlyOne<{
    readonly columns?: ReturnableColumnName[];
    readonly exprs?: ReturnableColumnExpr[];
  }>;

export interface InsertStmtPreparerOptions<
  TableName extends string,
  InsertableRecord,
  ReturnableRecord,
  Context extends tmpl.SqlEmitContext,
  DomainQS extends d.SqlDomainQS,
  InsertableColumnName extends keyof InsertableRecord = keyof InsertableRecord,
> {
  readonly sqlNS?: ns.SqlNamespaceSupplier;
  readonly isColumnEmittable?: (
    columnName: keyof InsertableRecord,
    record: InsertableRecord,
    columnDefn: d.SqlDomain<
      Any,
      Context,
      Extract<InsertableColumnName, string>,
      DomainQS
    >,
    tableName: TableName,
  ) => boolean;
  readonly emitColumn?: (
    columnName: keyof InsertableRecord,
    record: InsertableRecord,
    columnDefn: d.SqlDomain<
      Any,
      Context,
      Extract<InsertableColumnName, string>,
      DomainQS
    >,
    tableName: TableName,
    ns: tmpl.SqlObjectNames,
    ctx: Context,
  ) =>
    | [columNameSqlText: string, value: unknown, valueSqlText: string]
    | undefined;
  readonly where?:
    | tmpl.SqlTextSupplier<Context>
    | ((
      ctx: Context,
    ) => tmpl.SqlTextSupplier<Context>);
  readonly onConflict?:
    | tmpl.SqlTextSupplier<Context>
    | ((
      ctx: Context,
    ) => tmpl.SqlTextSupplier<Context>);
  readonly returning?:
    | InsertStmtReturning<ReturnableRecord>
    | ((
      ctx: Context,
    ) => InsertStmtReturning<ReturnableRecord>);
  readonly transformSQL?: (
    suggested: string,
    tableName: TableName,
    records: InsertableRecord | InsertableRecord[],
    names: InsertableColumnName[],
    values: [value: unknown, sqlText: string][][],
    tableNS: tmpl.SqlObjectNames,
    columnsNS: tmpl.SqlObjectNames,
    ctx: Context,
  ) => string;
}

export interface InsertStmtPreparerSync<
  TableName extends string,
  InsertableRecord,
  ReturnableRecord,
  Context extends tmpl.SqlEmitContext,
  DomainQS extends d.SqlDomainQS,
> {
  (
    ir: InsertableRecord | InsertableRecord[],
    options?: InsertStmtPreparerOptions<
      TableName,
      InsertableRecord,
      ReturnableRecord,
      Context,
      DomainQS
    >,
  ): tmpl.SqlTextSupplier<Context> & {
    readonly insertable: InsertableRecord | InsertableRecord[];
    readonly returnable: (ir: InsertableRecord) => ReturnableRecord;
  };
}

export interface InsertStmtPreparer<
  TableName extends string,
  InsertableRecord,
  ReturnableRecord,
  Context extends tmpl.SqlEmitContext,
  DomainQS extends d.SqlDomainQS,
> {
  (
    ir: InsertableRecord | InsertableRecord[],
    options?: InsertStmtPreparerOptions<
      TableName,
      InsertableRecord,
      ReturnableRecord,
      Context,
      DomainQS
    >,
  ): Promise<
    tmpl.SqlTextSupplier<Context> & {
      readonly insertable: InsertableRecord | InsertableRecord[];
      readonly returnable: (ir: InsertableRecord) => ReturnableRecord;
    }
  >;
}

export function typicalInsertValuesSqlPreparerSync<
  TableName extends string,
  InsertableRecord,
  ReturnableRecord,
  Context extends tmpl.SqlEmitContext,
  DomainQS extends d.SqlDomainQS,
  DomainsQS extends d.SqlDomainsQS<DomainsQS>,
  InsertableColumnName extends keyof InsertableRecord = keyof InsertableRecord,
>(
  ctx: Context,
  irSupplier: InsertableRecord | InsertableRecord[],
  tableName: TableName,
  candidateColumns: (
    group?: "all" | "primary-keys",
  ) => d.SqlDomain<
    Any,
    Context,
    Extract<InsertableColumnName, string>,
    DomainQS
  >[],
  ispOptions?: InsertStmtPreparerOptions<
    TableName,
    InsertableRecord,
    ReturnableRecord,
    Context,
    DomainQS
  >,
) {
  const records = Array.isArray(irSupplier) ? irSupplier : [irSupplier];
  const isIdenticallyShaped = r.isIdenticallyShaped(records as object[]);

  const { isColumnEmittable, emitColumn } = ispOptions ?? {};
  const { sqlTextEmitOptions: eo } = ctx;
  const ns = ctx.sqlNamingStrategy(ctx, {
    quoteIdentifiers: true,
    qnss: ispOptions?.sqlNS,
  });
  const names: InsertableColumnName[] = [];
  const values: [value: unknown, valueSqlText: string][][] = [];
  for (let rowNum = 0; rowNum < records.length; rowNum++) {
    const ir = records[rowNum];
    const rowValues: typeof values[number] = [];
    candidateColumns().forEach((cdom) => {
      const cn = cdom.identity as InsertableColumnName;
      if (
        isColumnEmittable && !isColumnEmittable(cn, ir, cdom, tableName)
      ) {
        return;
      }

      let ec: [
        columNameSqlText: string,
        value: unknown,
        valueSqlText: string,
      ] | undefined;
      if (emitColumn) {
        ec = emitColumn(cn, ir, cdom, tableName, ns, ctx);
      } else {
        const { quotedLiteral } = eo;
        const recordValueRaw = (ir as Any)[cn];
        if (tmpl.isSqlTextSupplier(recordValueRaw)) {
          ec = [
            cn as string,
            recordValueRaw,
            `(${recordValueRaw.SQL(ctx)})`, // e.g. `(SELECT x from y) as SQL expr`
          ];
        } else {
          const qValue = cdom.sqlDmlQuotedLiteral
            ? cdom.sqlDmlQuotedLiteral(
              "insert",
              recordValueRaw,
              quotedLiteral,
              ir as Record<string, Any>,
              ctx,
            )
            : quotedLiteral(recordValueRaw);
          ec = [cn as string, ...qValue];
        }
      }
      if (ec) {
        const [columNameSqlText, value, valueSqlText] = ec;
        if (rowNum == 0) names.push(columNameSqlText as InsertableColumnName);
        rowValues.push([value, valueSqlText]);
      }
    });
    values.push(rowValues);
  }
  return { names, values, isIdenticallyShaped };
}

export function typicalInsertStmtSqlPreparerSync<
  TableName extends string,
  InsertableRecord,
  ReturnableRecord,
  Context extends tmpl.SqlEmitContext,
  DomainQS extends d.SqlDomainQS,
  InsertableColumnName extends keyof InsertableRecord = keyof InsertableRecord,
>(
  ir: InsertableRecord | InsertableRecord[],
  tableName: TableName,
  candidateColumns: (
    group?: "all" | "primary-keys",
  ) => d.SqlDomain<
    Any,
    Context,
    Extract<InsertableColumnName, string>,
    DomainQS
  >[],
  ispOptions?: InsertStmtPreparerOptions<
    TableName,
    InsertableRecord,
    ReturnableRecord,
    Context,
    DomainQS
  >,
): tmpl.SqlTextSupplier<Context> {
  return {
    SQL: (ctx) => {
      const { returning: returningArg, where, onConflict } = ispOptions ?? {};
      const tns = ctx.sqlNamingStrategy(ctx, {
        quoteIdentifiers: true,
        qnss: ispOptions?.sqlNS,
      });
      const cns = ctx.sqlNamingStrategy(ctx, {
        quoteIdentifiers: true,
      });
      const { names, values } = typicalInsertValuesSqlPreparerSync(
        ctx,
        ir,
        tableName,
        candidateColumns,
        ispOptions,
      );
      const sqlText = (
        ss?:
          | tmpl.SqlTextSupplier<Context>
          | ((ctx: Context) => tmpl.SqlTextSupplier<Context>),
      ) => {
        if (!ss) return "";
        const SQL = typeof ss == "function" ? ss(ctx).SQL(ctx) : ss.SQL(ctx);
        return ` ${SQL}`;
      };
      const returning = returningArg
        ? (typeof returningArg === "function"
          ? returningArg(ctx)
          : returningArg)
        : undefined;
      let returningSQL = "";
      if (typeof returning === "string") {
        switch (returning) {
          case "*":
            returningSQL = ` RETURNING *`;
            break;
          case "primary-keys":
            returningSQL = ` RETURNING ${
              candidateColumns("primary-keys").map((isd) =>
                cns.tableColumnName({ tableName, columnName: isd.identity })
              ).join(", ")
            }`;
            break;
        }
      } else if (typeof returning === "object") {
        if (returning.columns) {
          returningSQL = ` RETURNING ${
            returning!.columns!.map((n) =>
              cns.tableColumnName({ tableName, columnName: String(n) })
            ).join(", ")
          }`;
        } else {
          returningSQL = ` RETURNING ${returning!.exprs!.join(", ")}`;
        }
      }
      const multiValues = values.length > 1;
      const valuesClause = values.map((row) =>
        `(${row.map((value) => value[1]).join(", ")})`
      ).join(",\n              ");
      // deno-fmt-ignore
      const SQL = `INSERT INTO ${tns.tableName(tableName)} (${names.map(n => cns.tableColumnName({ tableName, columnName: String(n) })).join(", ")})${multiValues ? "\n       " : " "}VALUES ${valuesClause}${sqlText(where)}${sqlText(onConflict)}${returningSQL}`;
      return ispOptions?.transformSQL
        ? ispOptions?.transformSQL(
          SQL,
          tableName,
          ir,
          names,
          values,
          tns,
          cns,
          ctx,
        )
        : SQL;
    },
  };
}

export function typicalInsertStmtPreparerSync<
  TableName extends string,
  InsertableRecord,
  ReturnableRecord,
  Context extends tmpl.SqlEmitContext,
  DomainQS extends d.SqlDomainQS,
>(
  tableName: TableName,
  candidateColumns: (
    group?: "all" | "primary-keys",
  ) => d.SqlDomain<
    Any,
    Context,
    Extract<keyof InsertableRecord, string>,
    DomainQS
  >[],
  mutateValues?: (
    ir: safety.Writeable<InsertableRecord> | safety.Writeable<
      InsertableRecord
    >[],
  ) => InsertableRecord | InsertableRecord[],
  defaultIspOptions?: InsertStmtPreparerOptions<
    TableName,
    InsertableRecord,
    ReturnableRecord,
    Context,
    DomainQS
  >,
): InsertStmtPreparerSync<
  TableName,
  InsertableRecord,
  ReturnableRecord,
  Context,
  DomainQS
> {
  return (ir, ispOptions = defaultIspOptions) => {
    // typically used when Zod parser should be invoked before SQL generated
    if (mutateValues) ir = mutateValues(ir);
    return {
      insertable: ir,
      returnable: (ir) => ir as unknown as ReturnableRecord,
      ...typicalInsertStmtSqlPreparerSync(
        ir,
        tableName,
        candidateColumns,
        ispOptions,
      ),
    };
  };
}

export function typicalInsertStmtPreparer<
  TableName extends string,
  InsertableRecord,
  ReturnableRecord,
  Context extends tmpl.SqlEmitContext,
  DomainQS extends d.SqlDomainQS,
>(
  tableName: TableName,
  candidateColumns: (
    group?: "all" | "primary-keys",
  ) => d.SqlDomain<
    Any,
    Context,
    Extract<keyof InsertableRecord, string>,
    DomainQS
  >[],
  mutateValues?: (
    ir: safety.Writeable<InsertableRecord> | safety.Writeable<
      InsertableRecord
    >[],
  ) => Promise<InsertableRecord | InsertableRecord[]>,
  defaultIspOptions?: InsertStmtPreparerOptions<
    TableName,
    InsertableRecord,
    ReturnableRecord,
    Context,
    DomainQS
  >,
): InsertStmtPreparer<
  TableName,
  InsertableRecord,
  ReturnableRecord,
  Context,
  DomainQS
> {
  return async (ir, ispOptions = defaultIspOptions) => {
    // typically used when Zod parser should be invoked before SQL generated
    if (mutateValues) ir = await mutateValues(ir);
    return {
      insertable: ir,
      returnable: (ir) => ir as unknown as ReturnableRecord,
      ...typicalInsertStmtSqlPreparerSync(
        ir,
        tableName,
        candidateColumns,
        ispOptions,
      ),
    };
  };
}
