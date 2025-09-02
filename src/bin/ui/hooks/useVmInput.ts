import { useState } from "react";
import { useInput } from "ink";

interface VmData {
  id?: string;
  [key: string]: any;
}

interface UseVmInputOptions {
  vms?: VmData[];
  onSubmit: (id: string) => void;
}

export const useVmInput = ({ vms, onSubmit }: UseVmInputOptions) => {
  const [sandboxId, setSandboxId] = useState("");
  const [selectedVm, setSelectedVm] = useState<string | null>(null);
  const [selectedVmIndex, setSelectedVmIndex] = useState<number>(-1);

  const handleInputChange = (value: string) => {
    setSandboxId(value);

    // Clear VM selection when user types manually
    if (selectedVm) {
      setSelectedVm(null);
      setSelectedVmIndex(-1);
    }
  };

  const handleInputSubmit = () => {
    if (selectedVm) {
      onSubmit(selectedVm);
    } else if (sandboxId.trim()) {
      onSubmit(sandboxId);
    }
  };

  const handleVmSelect = (index: number, vmId: string) => {
    setSelectedVmIndex(index);
    setSelectedVm(vmId);
  };

  useInput((_input, key) => {
    if (key.upArrow || key.downArrow) {
      if (vms && vms.length > 0) {
        let newIndex = selectedVmIndex;

        if (key.upArrow) {
          newIndex =
            selectedVmIndex <= 0 ? vms.length - 1 : selectedVmIndex - 1;
        } else if (key.downArrow) {
          newIndex =
            selectedVmIndex >= vms.length - 1 ? 0 : selectedVmIndex + 1;
        }

        setSelectedVmIndex(newIndex);
        const vm = vms[newIndex];
        const vmId = vm?.id && typeof vm.id === "string" ? vm.id : null;
        setSelectedVm(vmId);

        // Set the selected VM ID in the text input
        if (vmId) {
          setSandboxId(vmId);
        }
      }
    }
  });

  return {
    sandboxId,
    selectedVm,
    selectedVmIndex,
    handleInputChange,
    handleInputSubmit,
    handleVmSelect,
  };
};
