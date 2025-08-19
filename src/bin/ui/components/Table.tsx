import React from "react";
import { Box, Text } from "ink";

interface TableProps {
  marginTop?: number;
  renderHeader: () => React.ReactNode;
  renderBody: (totalWidth: number) => React.ReactNode;
}

export const Table = ({ renderHeader, renderBody }: TableProps) => {
  // Calculate total width from TableHeader children
  const calculateTotalWidth = () => {
    let totalWidth = 0;

    const headerElement = renderHeader();

    if (
      React.isValidElement(headerElement) &&
      headerElement.type === TableHeader
    ) {
      React.Children.forEach(
        (headerElement.props as any).children,
        (headerChild) => {
          if (
            React.isValidElement(headerChild) &&
            headerChild.type === TableColumn
          ) {
            totalWidth += (headerChild.props as any).width || 0;
          }
        }
      );
    }

    return totalWidth;
  };

  const totalWidth = calculateTotalWidth();

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      paddingX={1}
      width={totalWidth + 4}
    >
      {renderHeader()}
      {renderBody(totalWidth)}
    </Box>
  );
};

interface TableHeaderProps {
  children: React.ReactNode;
}

export const TableHeader = ({ children }: TableHeaderProps) => (
  <Box flexDirection="row">{children}</Box>
);

interface TableBodyProps {
  children: React.ReactNode;
  totalWidth: number;
}

export const TableBody = ({ children, totalWidth }: TableBodyProps) => (
  <Box flexDirection="column">
    <Box>
      <Text dimColor>{"─".repeat(Math.max(totalWidth, 50))}</Text>
    </Box>
    {children}
  </Box>
);

interface TableRowProps {
  children: React.ReactNode;
  isSelected?: boolean;
}

export const TableRow = ({ children, isSelected = false }: TableRowProps) => (
  <Box flexDirection="row">
    {React.Children.map(children, (child) => {
      if (React.isValidElement(child) && child.type === TableColumn) {
        return React.cloneElement(child, { inverse: isSelected } as any);
      }
      return child;
    })}
  </Box>
);

interface TableColumnProps {
  children: React.ReactNode;
  width?: number;
  bold?: boolean;
  inverse?: boolean;
}

export const TableColumn = ({
  children,
  width,
  bold = false,
  inverse = false,
}: TableColumnProps) => (
  <Box width={width}>
    <Text bold={bold} inverse={inverse}>
      {children}
    </Text>
  </Box>
);
