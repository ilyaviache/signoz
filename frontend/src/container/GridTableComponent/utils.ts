import { ColumnsType, ColumnType } from 'antd/es/table';
import { ThresholdProps } from 'container/NewWidget/RightContainer/Threshold/types';
import { QUERY_TABLE_CONFIG } from 'container/QueryTable/config';
import { QueryTableProps } from 'container/QueryTable/QueryTable.intefaces';
import { RowData } from 'lib/query/createTableColumnsFromQuery';
import { isEmpty, isNaN } from 'lodash-es';
import { Query } from 'types/api/queryBuilder/queryBuilderData';
import { EQueryType } from 'types/common/dashboard';

// Helper function to evaluate the condition based on the operator
function evaluateCondition(
	operator: string | undefined,
	value: number,
	thresholdValue: number,
): boolean {
	switch (operator) {
		case '>':
			return value > thresholdValue;
		case '<':
			return value < thresholdValue;
		case '>=':
			return value >= thresholdValue;
		case '<=':
			return value <= thresholdValue;
		case '==':
			return value === thresholdValue;
		default:
			return false;
	}
}

export function findMatchingThreshold(
	thresholds: ThresholdProps[],
	label: string,
	value: number,
): {
	threshold: ThresholdProps;
	hasMultipleMatches: boolean;
} {
	const matchingThresholds: ThresholdProps[] = [];
	let hasMultipleMatches = false;

	thresholds.forEach((threshold) => {
		if (
			threshold.thresholdValue !== undefined &&
			threshold.thresholdTableOptions === label &&
			evaluateCondition(
				threshold.thresholdOperator,
				value,
				threshold.thresholdValue,
			)
		) {
			matchingThresholds.push(threshold);
		}
	});

	if (matchingThresholds.length > 1) {
		hasMultipleMatches = true;
	}

	return {
		threshold: matchingThresholds[0],
		hasMultipleMatches,
	};
}

export interface TableData {
	columns: { name: string; queryName: string; isValueColumn: boolean }[];
	rows: { data: any }[];
}

export function getQueryLegend(
	currentQuery: Query,
	queryName: string,
): string | undefined {
	let legend: string | undefined;
	switch (currentQuery.queryType) {
		case EQueryType.QUERY_BUILDER:
			// check if the value is present in the queries
			legend = currentQuery.builder.queryData.find(
				(query) => query.queryName === queryName,
			)?.legend;

			if (!legend) {
				// check if the value is present in the formula
				legend = currentQuery.builder.queryFormulas.find(
					(query) => query.queryName === queryName,
				)?.legend;
			}
			break;
		case EQueryType.CLICKHOUSE:
			legend = currentQuery.clickhouse_sql.find(
				(query) => query.name === queryName,
			)?.legend;
			break;
		case EQueryType.PROM:
			legend = currentQuery.promql.find((query) => query.name === queryName)
				?.legend;
			break;
		default:
			legend = undefined;
			break;
	}

	return legend;
}

export function createColumnsAndDataSource(
	data: TableData,
	currentQuery: Query,
	renderColumnCell?: QueryTableProps['renderColumnCell'],
): { columns: ColumnsType<RowData>; dataSource: RowData[] } {
	const columns: ColumnsType<RowData> =
		data.columns?.reduce<ColumnsType<RowData>>((acc, item) => {
			// is the column is the value column then we need to check for the available legend
			const legend = item.isValueColumn
				? getQueryLegend(currentQuery, item.queryName)
				: undefined;

			const column: ColumnType<RowData> = {
				dataIndex: item.name,
				// if no legend present then rely on the column name value
				title: !isEmpty(legend) ? legend : item.name,
				width: QUERY_TABLE_CONFIG.width,
				render: renderColumnCell && renderColumnCell[item.name],
				sorter: (a: RowData, b: RowData): number => {
					const valueA = Number(a[`${item.name}_without_unit`] ?? a[item.name]);
					const valueB = Number(b[`${item.name}_without_unit`] ?? b[item.name]);

					if (!isNaN(valueA) && !isNaN(valueB)) {
						return valueA - valueB;
					}

					return ((a[item.name] as string) || '').localeCompare(
						(b[item.name] as string) || '',
					);
				},
			};

			return [...acc, column];
		}, []) || [];

	// the rows returned have data encapsulation hence removing the same here
	const dataSource = data.rows?.map((d) => d.data) || [];

	return { columns, dataSource };
}
