import { NestedKey } from "./types";

export interface PitcherCapabilities {
  client?: {
    status?: boolean;
    list?: boolean;
  };
  file?: {
    status?: boolean;
    // open and close by id
    openClose?: boolean;
    openByPath?: boolean;
    save?: boolean;
    ot?: boolean;
    selection?: boolean;
  };
  fs?: {
    raw?: boolean;
    read?: boolean;
    operations?: boolean;
    search?: boolean;
    streamingSearch?: boolean;
    pathSearch?: boolean;
  };
  git?: {
    status?: boolean;
    targetDiff?: boolean;
    pull?: boolean;
    discard?: boolean;
    commit?: boolean;
    renameBranch?: boolean;
  };
  language?: {
    list?: boolean;
    // Our lsp proxy using lspRequest and lspNotification
    // in the future we might add a more spec-compliant version
    pitcherLsp?: boolean;
  };
  port?: {
    list?: boolean;
    status?: boolean;
  };
  setup?: {
    // Naming of these is a bit vague
    get?: boolean;
    skip?: boolean;
    skipAll?: boolean;
    setStep?: boolean;
    progress?: boolean;
  };
  shell?: {
    // in and out
    io?: boolean;
    list?: boolean;
    // open/close is basically subscribe/unsubscribe, not the best naming here?
    // Actually opening and closing the shell is create and terminate
    openClose?: boolean;
    createTerminate?: boolean;
    restart?: boolean;
    resize?: boolean;
    // exit, restart, terminate notifications
    status?: boolean;
  };
  task?: {
    list?: boolean;
    run?: boolean;
    stop?: boolean;
    runCommand?: boolean;
    create?: boolean;
    update?: boolean;
    saveToConfig?: boolean;
    generateConfig?: boolean;
    createSetupTasks?: boolean;
  };
  channel?: {
    // join & leave
    subscribe?: boolean;
    message?: boolean;
  };
  system?: {
    hibernation?: boolean;
    update?: boolean;
    metrics: boolean;
    containers?: boolean;
  };
  command?: {
    list?: boolean;
    execute?: boolean;
  };
  ai?: {
    raw?: number;
    suggestCommit?: number;
    chat?: number;
    embeddings?: number;
  };
  box?: {
    installDependencies?: boolean;
    installedDependencies?: boolean;
  };
}

interface BasePitcherPermissions {
  file: {
    open: boolean;
    documentOperation: boolean;
    documentSelection: boolean;
    save: boolean;
    documentAck: boolean;
    close: boolean;
  };
  fs: {
    read: boolean;
    operation: boolean;
    search: boolean;
    pathSearch: boolean;
    upload: boolean;
    download: boolean;
  };
  language: {
    list: boolean;
    lspRead: boolean;
    lspWrite: boolean;
  };
  git: {
    status: boolean;
    pull: boolean;
    commit: boolean;
    discard: boolean;
    renameBranch: boolean;
    remoteContent: boolean;
    diffStatus: boolean;
    remotes: boolean;
    push: boolean;
  };
  setup: {
    get: boolean;
    skip: boolean;
    skipAll: boolean;
    setStep: boolean;
    enable: boolean;
    disable: boolean;
    init: boolean;
  };
  shell: {
    create: boolean;
    write: boolean;
    list: boolean;
    open: boolean;
    close: boolean;
    restart: boolean;
    terminate: boolean;
    resize: boolean;
  };
  task: {
    list: boolean;
    run: boolean;
    stop: boolean;
    runCommand: boolean;
    create: boolean;
    update: boolean;
    saveToConfig: boolean;
    generateConfig: boolean;
    createSetupTasks: boolean;
  };
  command: {
    list: boolean;
    execute: boolean;
  };
  system: {
    update: boolean;
    hibernate: boolean;
    metrics: boolean;
    containers: boolean;
  };
  ai: {
    // Generate code/description that would be used for edits
    suggest?: boolean;
    // Explains existing code, purely visual within the editor, no edits anywhere
    explain?: boolean;
    // Ability to run raw openai queries, should be reserved for csb employees?
    raw?: boolean;
    // Ability to create and interact with chat
    chat?: boolean;
    embeddings?: boolean;
  };
}

export type PitcherPermissions = Partial<BasePitcherPermissions>;

export type PitcherPermissionKeys = NestedKey<BasePitcherPermissions>;
