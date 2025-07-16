import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useInput, type Key } from "ink";
import chalk from "chalk";

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  isFocused?: boolean;
  showCursor?: boolean;
}

// Helper function to check if a key is a regular printable character
const isRegularKey = (key: Key) => {
  return (
    !key.ctrl &&
    !key.meta &&
    !key.shift &&
    !key.upArrow &&
    !key.downArrow &&
    !key.return &&
    !key.backspace &&
    !key.delete &&
    !key.tab &&
    !key.escape &&
    !key.leftArrow &&
    !key.rightArrow
  );
};

export const TextInput: React.FC<TextInputProps> = ({
  value,
  onChange,
  onSubmit,
  isFocused = true,
  showCursor = true,
}) => {
  const [cursorPosition, setCursorPosition] = useState(value.length);
  const isInternalChange = useRef(false);

  // Only update cursor position when value changes externally
  useEffect(() => {
    if (!isInternalChange.current) {
      setCursorPosition(value.length);
    }
    isInternalChange.current = false;
  }, [value]);

  useInput(
    (input, key) => {
      if (key.return && onSubmit) {
        onSubmit();
      } else if (key.leftArrow) {
        setCursorPosition(Math.max(0, cursorPosition - 1));
      } else if (key.rightArrow) {
        setCursorPosition(Math.min(value.length, cursorPosition + 1));
      } else if (key.backspace || key.delete) {
        // Both backspace and delete remove the character before the cursor
        if (cursorPosition > 0) {
          const newValue =
            value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
          const newCursorPosition = cursorPosition - 1;
          isInternalChange.current = true;
          
          onChange(newValue);
          setCursorPosition(newCursorPosition);
        }
      } else if (input && isRegularKey(key)) {
        // Insert character(s) at cursor position
        const newValue =
          value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
        let newCursorPosition = cursorPosition + input.length;

        // Ensure cursor stays within bounds
        if (newCursorPosition < 0) {
          newCursorPosition = 0;
        }
        if (newCursorPosition > newValue.length) {
          newCursorPosition = newValue.length;
        }

        isInternalChange.current = true;
        onChange(newValue);
        setCursorPosition(newCursorPosition);
      }
    },
    { isActive: isFocused }
  );

  const renderText = () => {
    const displayValue = value || "";

    if (!showCursor || !isFocused) {
      // When cursor is hidden, just show the text
      return <Text>{displayValue}</Text>;
    }

    let renderedValue = "";

    if (displayValue.length === 0) {
      // Show cursor when there's no text
      renderedValue = chalk.inverse(" ");
    } else {
      // Show value with cursor
      renderedValue = "";

      for (let i = 0; i < displayValue.length; i++) {
        const char = displayValue[i];
        if (i === cursorPosition) {
          renderedValue += chalk.inverse(char);
        } else {
          renderedValue += char;
        }
      }

      // Add cursor at the end if position is at the end
      if (cursorPosition === displayValue.length) {
        renderedValue += chalk.inverse(" ");
      }
    }

    return <Text>{renderedValue}</Text>;
  };

  return (
    <Box minWidth={30} borderStyle="round" paddingX={1}>
      {renderText()}
    </Box>
  );
};
