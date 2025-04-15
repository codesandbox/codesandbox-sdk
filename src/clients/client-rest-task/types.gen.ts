// This file is auto-generated by @hey-api/openapi-ts

export type SuccessResponse = {
    /**
     * Status code for successful operations
     */
    status: 0;
    /**
     * Result payload for the operation
     */
    result: {
        [key: string]: unknown;
    };
};

export type ErrorResponse = {
    /**
     * Status code for error operations
     */
    status: 1;
    /**
     * Error details
     */
    error: {
        [key: string]: unknown;
    };
};

export type CommonError = {
    /**
     * Error code
     */
    code: number;
    /**
     * Error message
     */
    message?: string;
    /**
     * Additional error data
     */
    data?: {
        [key: string]: unknown;
    } | null;
};

export type TaskError = {
    /**
     * CONFIG_FILE_ALREADY_EXISTS error code
     */
    code: 600;
    /**
     * Error message
     */
    message: string;
} | {
    /**
     * TASK_NOT_FOUND error code
     */
    code: 601;
    /**
     * Error message
     */
    message: string;
} | {
    /**
     * COMMAND_ALREADY_CONFIGURED error code
     */
    code: 602;
    /**
     * Error message
     */
    message: string;
} | ({
    code?: 'CommonError';
} & CommonError);

export type TaskDefinitionDto = {
    /**
     * Name of the task
     */
    name: string;
    /**
     * Command to run for the task
     */
    command: string;
    /**
     * Whether the task should run when the sandbox starts
     */
    runAtStart?: boolean | null;
    preview?: {
        /**
         * Port to preview from this task
         */
        port?: number | null;
        /**
         * Type of PR link to use
         */
        'pr-link'?: 'direct' | 'redirect' | 'devtool';
    } | null;
};

export type CommandShellDto = {
    /**
     * ID of the shell command
     */
    id: string;
    /**
     * Command being executed
     */
    command: string;
    /**
     * Current status of the shell command
     */
    status: 'initializing' | 'running' | 'stopped' | 'error';
    /**
     * Current output of the command
     */
    output: string;
};

export type Port = {
    /**
     * Port number
     */
    port: number;
    /**
     * Hostname the port is bound to
     */
    hostname: string;
    /**
     * Current status of the port
     */
    status: 'open' | 'closed';
    /**
     * ID of the task that opened this port
     */
    taskId?: string | null;
};

export type TaskDto = TaskDefinitionDto & {
    /**
     * Unique ID of the task
     */
    id: string;
    /**
     * Whether this task is unconfigured (not saved in config)
     */
    unconfigured?: boolean | null;
    shell: CommandShellDto | null;
    /**
     * Ports opened by this task
     */
    ports: Array<Port>;
};

export type TaskListDto = {
    /**
     * Map of task IDs to task objects
     */
    tasks: {
        [key: string]: TaskDto;
    };
    /**
     * Tasks that run during sandbox setup
     */
    setupTasks: Array<TaskDefinitionDto>;
    /**
     * Validation errors in the task configuration
     */
    validationErrors: Array<string>;
};

export type TaskListData = {
    body: {
        [key: string]: unknown;
    };
    path?: never;
    query?: never;
    url: '/task/list';
};

export type TaskListErrors = {
    /**
     * Error retrieving task list
     */
    400: ErrorResponse & {
        error?: CommonError;
    };
};

export type TaskListError = TaskListErrors[keyof TaskListErrors];

export type TaskListResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: TaskListDto;
    };
};

export type TaskListResponse = TaskListResponses[keyof TaskListResponses];

export type TaskRunData = {
    body: {
        /**
         * ID of the task to run
         */
        taskId: string;
    };
    path?: never;
    query?: never;
    url: '/task/run';
};

export type TaskRunErrors = {
    /**
     * Error running task
     */
    400: ErrorResponse & {
        error?: TaskError;
    };
};

export type TaskRunError = TaskRunErrors[keyof TaskRunErrors];

export type TaskRunResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: TaskDto;
    };
};

export type TaskRunResponse = TaskRunResponses[keyof TaskRunResponses];

export type TaskRunCommandData = {
    body: {
        /**
         * Command to run
         */
        command: string;
        /**
         * Optional name for the task
         */
        name?: string | null;
        /**
         * Whether to save this command as a task in the config
         */
        saveToConfig?: boolean | null;
    };
    path?: never;
    query?: never;
    url: '/task/runCommand';
};

export type TaskRunCommandErrors = {
    /**
     * Error running command
     */
    400: ErrorResponse & {
        error?: TaskError;
    };
};

export type TaskRunCommandError = TaskRunCommandErrors[keyof TaskRunCommandErrors];

export type TaskRunCommandResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: TaskDto;
    };
};

export type TaskRunCommandResponse = TaskRunCommandResponses[keyof TaskRunCommandResponses];

export type TaskStopData = {
    body: {
        /**
         * ID of the task to stop
         */
        taskId: string;
    };
    path?: never;
    query?: never;
    url: '/task/stop';
};

export type TaskStopErrors = {
    /**
     * Error stopping task
     */
    400: ErrorResponse & {
        error?: TaskError;
    };
};

export type TaskStopError = TaskStopErrors[keyof TaskStopErrors];

export type TaskStopResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: TaskDto | unknown;
    };
};

export type TaskStopResponse = TaskStopResponses[keyof TaskStopResponses];

export type TaskCreateData = {
    body: {
        taskFields: TaskDefinitionDto;
        /**
         * Whether to start the task immediately after creation
         */
        startTask?: boolean | null;
    };
    path?: never;
    query?: never;
    url: '/task/create';
};

export type TaskCreateErrors = {
    /**
     * Error creating task
     */
    400: ErrorResponse & {
        error?: TaskError;
    };
};

export type TaskCreateError = TaskCreateErrors[keyof TaskCreateErrors];

export type TaskCreateResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: TaskListDto;
    };
};

export type TaskCreateResponse = TaskCreateResponses[keyof TaskCreateResponses];

export type TaskUpdateData = {
    body: {
        /**
         * ID of the task to update
         */
        taskId: string;
        /**
         * Fields to update in the task
         */
        taskFields: {
            /**
             * Name of the task
             */
            name?: string | null;
            /**
             * Command to run
             */
            command?: string | null;
            /**
             * Whether to run the task at sandbox start
             */
            runAtStart?: boolean | null;
            preview?: {
                /**
                 * Port to use for previewing the task
                 */
                port?: number | null;
                /**
                 * Type of PR link to use
                 */
                'pr-link'?: 'direct' | 'redirect' | 'devtool';
            } | null;
        };
    };
    path?: never;
    query?: never;
    url: '/task/update';
};

export type TaskUpdateErrors = {
    /**
     * Error updating task
     */
    400: ErrorResponse & {
        error?: TaskError;
    };
};

export type TaskUpdateError = TaskUpdateErrors[keyof TaskUpdateErrors];

export type TaskUpdateResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: TaskDto;
    };
};

export type TaskUpdateResponse = TaskUpdateResponses[keyof TaskUpdateResponses];

export type TaskSaveToConfigData = {
    body: {
        /**
         * ID of the task to save to config
         */
        taskId: string;
    };
    path?: never;
    query?: never;
    url: '/task/saveToConfig';
};

export type TaskSaveToConfigErrors = {
    /**
     * Error saving task to config
     */
    400: ErrorResponse & {
        error?: TaskError;
    };
};

export type TaskSaveToConfigError = TaskSaveToConfigErrors[keyof TaskSaveToConfigErrors];

export type TaskSaveToConfigResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: TaskDto;
    };
};

export type TaskSaveToConfigResponse = TaskSaveToConfigResponses[keyof TaskSaveToConfigResponses];

export type TaskGenerateConfigData = {
    body: {
        [key: string]: unknown;
    };
    path?: never;
    query?: never;
    url: '/task/generateConfig';
};

export type TaskGenerateConfigErrors = {
    /**
     * Error generating config
     */
    400: ErrorResponse & {
        error?: TaskError;
    };
};

export type TaskGenerateConfigError = TaskGenerateConfigErrors[keyof TaskGenerateConfigErrors];

export type TaskGenerateConfigResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: unknown;
    };
};

export type TaskGenerateConfigResponse = TaskGenerateConfigResponses[keyof TaskGenerateConfigResponses];

export type TaskCreateSetupTasksData = {
    body: {
        /**
         * Setup tasks to create
         */
        tasks: Array<TaskDefinitionDto>;
    };
    path?: never;
    query?: never;
    url: '/task/createSetupTasks';
};

export type TaskCreateSetupTasksErrors = {
    /**
     * Error creating setup tasks
     */
    400: ErrorResponse & {
        error?: TaskError;
    };
};

export type TaskCreateSetupTasksError = TaskCreateSetupTasksErrors[keyof TaskCreateSetupTasksErrors];

export type TaskCreateSetupTasksResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: unknown;
    };
};

export type TaskCreateSetupTasksResponse = TaskCreateSetupTasksResponses[keyof TaskCreateSetupTasksResponses];