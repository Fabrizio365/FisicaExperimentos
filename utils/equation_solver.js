/**
 * Solucionador de sistemas de ecuaciones lineales
 * Implementa múltiples métodos numéricos para diferentes tipos de matrices
 */
class EquationSolver {
    constructor() {
        this.tolerance = 1e-10;
        this.maxIterations = 1000;
        this.debugMode = false;
    }

    /**
     * Resuelve un sistema de ecuaciones lineales Ax = b
     */
    solve(matrices) {
        try {
            console.log('🧮 Resolviendo sistema de ecuaciones...');

            // Validar entrada
            this.validateInput(matrices);

            const { systemMatrix, rightHandSide, method } = matrices;
            
            // Seleccionar método de solución óptimo
            const solverMethod = this.selectSolverMethod(matrices);
            console.log(`📐 Método seleccionado: ${solverMethod}`);

            let solution;
            const startTime = performance.now();

            // Resolver según el método
            switch (solverMethod) {
                case 'direct_elimination':
                    solution = this.gaussianElimination(systemMatrix, rightHandSide);
                    break;
                
                case 'lu_decomposition':
                    solution = this.luDecomposition(systemMatrix, rightHandSide);
                    break;
                
                case 'cholesky':
                    solution = this.choleskyDecomposition(systemMatrix, rightHandSide);
                    break;
                
                case 'iterative_jacobi':
                    solution = this.jacobiMethod(systemMatrix, rightHandSide);
                    break;
                
                case 'iterative_gauss_seidel':
                    solution = this.gaussSeidelMethod(systemMatrix, rightHandSide);
                    break;
                
                case 'cramer':
                    solution = this.cramerRule(systemMatrix, rightHandSide);
                    break;
                
                case 'series_simple':
                    solution = this.solveSeriesCircuit(matrices);
                    break;
                
                case 'parallel_simple':
                    solution = this.solveParallelCircuit(matrices);
                    break;
                
                default:
                    solution = this.gaussianElimination(systemMatrix, rightHandSide);
            }

            const solveTime = performance.now() - startTime;

            // Verificar solución
            const verification = this.verifySolution(systemMatrix, rightHandSide, solution.values);

            const result = {
                isValid: solution.isValid,
                error: solution.error,
                nodeVoltages: this.extractNodeVoltages(solution.values, matrices),
                branchCurrents: this.extractBranchCurrents(solution.values, matrices),
                solverMethod: solverMethod,
                iterations: solution.iterations || 0,
                residual: verification.residual,
                solveTime: solveTime,
                convergence: solution.convergence || {}
            };

            if (!verification.isValid) {
                result.warnings = result.warnings || [];
                result.warnings.push(`Verificación falló: residual = ${verification.residual.toExponential(3)}`);
            }

            console.log(`✅ Sistema resuelto en ${solveTime.toFixed(2)}ms, residual: ${verification.residual.toExponential(3)}`);
            return result;

        } catch (error) {
            console.error('❌ Error resolviendo sistema:', error);
            return {
                isValid: false,
                error: `Error en solucionador: ${error.message}`
            };
        }
    }

    /**
     * Valida la entrada del sistema
     */
    validateInput(matrices) {
        if (!matrices.systemMatrix || !matrices.rightHandSide) {
            throw new Error('Matriz del sistema o vector RHS no definidos');
        }

        const matrix = matrices.systemMatrix;
        const rhs = matrices.rightHandSide;

        if (matrix.length === 0 || matrix[0].length === 0) {
            throw new Error('Matriz del sistema vacía');
        }

        if (matrix.length !== matrix[0].length) {
            throw new Error(`Matriz no cuadrada: ${matrix.length}x${matrix[0].length}`);
        }

        if (matrix.length !== rhs.length) {
            throw new Error(`Dimensiones inconsistentes: matriz ${matrix.length}x${matrix[0].length}, RHS ${rhs.length}`);
        }
    }

    /**
     * Selecciona el método de solución óptimo
     */
    selectSolverMethod(matrices) {
        const n = matrices.systemMatrix.length;
        const { method, conditioning } = matrices;

        // Casos especiales para circuitos simples
        if (method === 'series') {
            return 'series_simple';
        }
        if (method === 'parallel') {
            return 'parallel_simple';
        }

        // Para sistemas pequeños (n ≤ 3), usar regla de Cramer
        if (n <= 3 && conditioning && Math.abs(conditioning.determinant) > this.tolerance) {
            return 'cramer';
        }

        // Para matrices simétricas definidas positivas, usar Cholesky
        if (conditioning && conditioning.isSymmetric && conditioning.isPositiveDefinite) {
            return 'cholesky';
        }

        // Para matrices bien condicionadas, usar eliminación gaussiana
        if (!conditioning || !conditioning.warning) {
            return n <= 10 ? 'direct_elimination' : 'lu_decomposition';
        }

        // Para matrices mal condicionadas, usar métodos iterativos
        if (conditioning.isDiagonallyDominant) {
            return 'iterative_gauss_seidel';
        }

        // Por defecto, eliminación gaussiana con pivoteo
        return 'direct_elimination';
    }

    /**
     * Eliminación gaussiana con pivoteo parcial
     */
    gaussianElimination(A, b) {
        const n = A.length;
        const augmented = A.map((row, i) => [...row, b[i]]);

        try {
            // Fase de eliminación hacia adelante
            for (let i = 0; i < n; i++) {
                // Pivoteo parcial
                let maxRow = i;
                for (let k = i + 1; k < n; k++) {
                    if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
                        maxRow = k;
                    }
                }

                // Intercambiar filas si es necesario
                if (maxRow !== i) {
                    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
                }

                // Verificar elemento pivote
                if (Math.abs(augmented[i][i]) < this.tolerance) {
                    throw new Error(`Elemento pivote muy pequeño en posición (${i}, ${i})`);
                }

                // Eliminación
                for (let k = i + 1; k < n; k++) {
                    const factor = augmented[k][i] / augmented[i][i];
                    for (let j = i; j <= n; j++) {
                        augmented[k][j] -= factor * augmented[i][j];
                    }
                }
            }

            // Sustitución hacia atrás
            const x = new Array(n);
            for (let i = n - 1; i >= 0; i--) {
                x[i] = augmented[i][n];
                for (let j = i + 1; j < n; j++) {
                    x[i] -= augmented[i][j] * x[j];
                }
                x[i] /= augmented[i][i];
            }

            return {
                isValid: true,
                values: x,
                method: 'gaussian_elimination'
            };

        } catch (error) {
            return {
                isValid: false,
                error: `Error en eliminación gaussiana: ${error.message}`,
                values: new Array(n).fill(0)
            };
        }
    }

    /**
     * Descomposición LU
     */
    luDecomposition(A, b) {
        const n = A.length;
        
        try {
            // Crear matrices L y U
            const L = this.createIdentityMatrix(n);
            const U = this.cloneMatrix(A);

            // Descomposición LU con pivoteo
            for (let i = 0; i < n; i++) {
                // Pivoteo parcial
                let maxRow = i;
                for (let k = i + 1; k < n; k++) {
                    if (Math.abs(U[k][i]) > Math.abs(U[maxRow][i])) {
                        maxRow = k;
                    }
                }

                if (maxRow !== i) {
                    [U[i], U[maxRow]] = [U[maxRow], U[i]];
                    // También intercambiar en L si ya se han calculado elementos
                    for (let j = 0; j < i; j++) {
                        [L[i][j], L[maxRow][j]] = [L[maxRow][j], L[i][j]];
                    }
                }

                // Verificar elemento pivote
                if (Math.abs(U[i][i]) < this.tolerance) {
                    throw new Error(`Pivote muy pequeño en descomposición LU: posición (${i}, ${i})`);
                }

                // Calcular elementos de L y U
                for (let k = i + 1; k < n; k++) {
                    L[k][i] = U[k][i] / U[i][i];
                    for (let j = i; j < n; j++) {
                        U[k][j] -= L[k][i] * U[i][j];
                    }
                }
            }

            // Resolver Ly = b
            const y = new Array(n);
            for (let i = 0; i < n; i++) {
                y[i] = b[i];
                for (let j = 0; j < i; j++) {
                    y[i] -= L[i][j] * y[j];
                }
                y[i] /= L[i][i];
            }

            // Resolver L^T x = y
            const x = new Array(n);
            for (let i = n - 1; i >= 0; i--) {
                x[i] = y[i];
                for (let j = i + 1; j < n; j++) {
                    x[i] -= L[j][i] * x[j];
                }
                x[i] /= L[i][i];
            }

            return {
                isValid: true,
                values: x,
                method: 'cholesky_decomposition',
                decomposition: { L }
            };

        } catch (error) {
            return {
                isValid: false,
                error: `Error en descomposición Cholesky: ${error.message}`,
                values: new Array(n).fill(0)
            };
        }
    }

    /**
     * Método iterativo de Jacobi
     */
    jacobiMethod(A, b) {
        const n = A.length;
        let x = new Array(n).fill(0); // Aproximación inicial
        let xNew = new Array(n);
        const convergence = { iterations: 0, residuals: [] };

        try {
            // Verificar convergencia diagonal
            if (!this.checkDiagonalDominance(A)) {
                console.warn('⚠️ Matriz no es diagonalmente dominante - convergencia no garantizada');
            }

            for (let iter = 0; iter < this.maxIterations; iter++) {
                // Calcular nueva aproximación
                for (let i = 0; i < n; i++) {
                    let sum = 0;
                    for (let j = 0; j < n; j++) {
                        if (i !== j) {
                            sum += A[i][j] * x[j];
                        }
                    }
                    xNew[i] = (b[i] - sum) / A[i][i];
                }

                // Verificar convergencia
                const residual = this.calculateResidual(A, b, xNew);
                convergence.residuals.push(residual);
                convergence.iterations = iter + 1;

                if (residual < this.tolerance) {
                    console.log(`🎯 Jacobi convergió en ${iter + 1} iteraciones`);
                    return {
                        isValid: true,
                        values: xNew,
                        method: 'jacobi_iterative',
                        iterations: iter + 1,
                        convergence: convergence
                    };
                }

                // Actualizar aproximación
                x = [...xNew];
            }

            throw new Error(`Jacobi no convergió en ${this.maxIterations} iteraciones`);

        } catch (error) {
            return {
                isValid: false,
                error: `Error en método Jacobi: ${error.message}`,
                values: x,
                convergence: convergence
            };
        }
    }

    /**
     * Método iterativo de Gauss-Seidel
     */
    gaussSeidelMethod(A, b) {
        const n = A.length;
        let x = new Array(n).fill(0); // Aproximación inicial
        const convergence = { iterations: 0, residuals: [] };

        try {
            // Verificar convergencia diagonal
            if (!this.checkDiagonalDominance(A)) {
                console.warn('⚠️ Matriz no es diagonalmente dominante - convergencia no garantizada');
            }

            for (let iter = 0; iter < this.maxIterations; iter++) {
                const xOld = [...x];

                // Actualizar cada componente usando valores ya actualizados
                for (let i = 0; i < n; i++) {
                    let sum = 0;
                    for (let j = 0; j < n; j++) {
                        if (i !== j) {
                            sum += A[i][j] * x[j];
                        }
                    }
                    x[i] = (b[i] - sum) / A[i][i];
                }

                // Verificar convergencia
                const residual = this.calculateResidual(A, b, x);
                convergence.residuals.push(residual);
                convergence.iterations = iter + 1;

                if (residual < this.tolerance) {
                    console.log(`🎯 Gauss-Seidel convergió en ${iter + 1} iteraciones`);
                    return {
                        isValid: true,
                        values: x,
                        method: 'gauss_seidel_iterative',
                        iterations: iter + 1,
                        convergence: convergence
                    };
                }
            }

            throw new Error(`Gauss-Seidel no convergió en ${this.maxIterations} iteraciones`);

        } catch (error) {
            return {
                isValid: false,
                error: `Error en método Gauss-Seidel: ${error.message}`,
                values: x,
                convergence: convergence
            };
        }
    }

    /**
     * Regla de Cramer (para sistemas pequeños)
     */
    cramerRule(A, b) {
        const n = A.length;

        try {
            // Calcular determinante de la matriz principal
            const detA = this.calculateDeterminant(A);
            
            if (Math.abs(detA) < this.tolerance) {
                throw new Error('Determinante muy pequeño para regla de Cramer');
            }

            const x = new Array(n);

            // Para cada variable, reemplazar columna y calcular determinante
            for (let i = 0; i < n; i++) {
                const Ai = this.cloneMatrix(A);
                // Reemplazar columna i con vector b
                for (let j = 0; j < n; j++) {
                    Ai[j][i] = b[j];
                }
                
                const detAi = this.calculateDeterminant(Ai);
                x[i] = detAi / detA;
            }

            return {
                isValid: true,
                values: x,
                method: 'cramer_rule',
                determinant: detA
            };

        } catch (error) {
            return {
                isValid: false,
                error: `Error en regla de Cramer: ${error.message}`,
                values: new Array(n).fill(0)
            };
        }
    }

    /**
     * Solución para circuitos en serie (caso especial)
     */
    solveSeriesCircuit(matrices) {
        const { dimensions } = matrices;
        const totalResistance = dimensions.totalResistance;
        const totalVoltage = dimensions.totalVoltage;

        if (totalResistance <= 0) {
            return {
                isValid: false,
                error: 'Resistencia total inválida en circuito serie'
            };
        }

        const current = totalVoltage / totalResistance;

        return {
            isValid: true,
            values: [current],
            method: 'series_analytical',
            seriesAnalysis: {
                totalCurrent: current,
                totalResistance: totalResistance,
                totalVoltage: totalVoltage
            }
        };
    }

    /**
     * Solución para circuitos en paralelo (caso especial)
     */
    solveParallelCircuit(matrices) {
        const { systemMatrix, rightHandSide, dimensions } = matrices;
        const sourceVoltage = dimensions.sourceVoltage;

        // En paralelo, cada corriente = V / R
        const currents = systemMatrix.map((row, i) => {
            const resistance = row[i]; // Elemento diagonal
            return resistance > 0 ? sourceVoltage / resistance : 0;
        });

        return {
            isValid: true,
            values: currents,
            method: 'parallel_analytical',
            parallelAnalysis: {
                branchCurrents: currents,
                sourceVoltage: sourceVoltage,
                totalCurrent: currents.reduce((sum, i) => sum + i, 0)
            }
        };
    }

    /**
     * Verifica la solución calculando el residual
     */
    verifySolution(A, b, x) {
        try {
            const residual = this.calculateResidual(A, b, x);
            const isValid = residual < this.tolerance * 1000; // Tolerancia más relajada para verificación

            return {
                isValid: isValid,
                residual: residual,
                relativeError: residual / (this.vectorNorm(b) + 1e-12)
            };

        } catch (error) {
            return {
                isValid: false,
                residual: Infinity,
                error: error.message
            };
        }
    }

    /**
     * Calcula el residual ||Ax - b||
     */
    calculateResidual(A, b, x) {
        const n = A.length;
        let residual = 0;

        for (let i = 0; i < n; i++) {
            let sum = 0;
            for (let j = 0; j < n; j++) {
                sum += A[i][j] * x[j];
            }
            const diff = sum - b[i];
            residual += diff * diff;
        }

        return Math.sqrt(residual);
    }

    /**
     * Extrae voltajes de nodo de la solución
     */
    extractNodeVoltages(solution, matrices) {
        const { method, nodeIndexMap } = matrices;
        const nodeVoltages = new Array(nodeIndexMap.size + 1).fill(0); // +1 para ground

        // Mapear solución a voltajes de nodo
        nodeIndexMap.forEach((index, nodeId) => {
            if (index < solution.length) {
                nodeVoltages[index] = solution[index];
            }
        });

        // Ground siempre es 0V
        if (matrices.groundNodeId !== undefined) {
            nodeVoltages[nodeVoltages.length - 1] = 0;
        }

        return nodeVoltages;
    }

    /**
     * Extrae corrientes de rama de la solución
     */
    extractBranchCurrents(solution, matrices) {
        const { method } = matrices;
        const branchCurrents = new Map();

        if (method === 'series') {
            // En serie, todas las ramas tienen la misma corriente
            const current = solution[0] || 0;
            matrices.branchIndexMap.forEach((index, branchId) => {
                branchCurrents.set(branchId, current);
            });
        } else if (method === 'parallel') {
            // En paralelo, cada rama tiene su propia corriente
            matrices.branchIndexMap.forEach((index, branchId) => {
                branchCurrents.set(branchId, solution[index] || 0);
            });
        } else {
            // Para métodos nodal/mesh, calcular corrientes desde voltajes
            // Esta es una simplificación - en implementación completa se calcularían
            // las corrientes usando las leyes de Kirchhoff
            matrices.branchIndexMap.forEach((index, branchId) => {
                branchCurrents.set(branchId, 0); // Placeholder
            });
        }

        return branchCurrents;
    }

    /**
     * Verifica dominancia diagonal
     */
    checkDiagonalDominance(matrix) {
        const n = matrix.length;

        for (let i = 0; i < n; i++) {
            const diagonal = Math.abs(matrix[i][i]);
            let offDiagonalSum = 0;
            
            for (let j = 0; j < n; j++) {
                if (i !== j) {
                    offDiagonalSum += Math.abs(matrix[i][j]);
                }
            }

            if (diagonal < offDiagonalSum) {
                return false;
            }
        }

        return true;
    }

    /**
     * Calcula determinante (hasta 4x4)
     */
    calculateDeterminant(matrix) {
        const n = matrix.length;

        if (n === 1) {
            return matrix[0][0];
        }

        if (n === 2) {
            return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
        }

        if (n === 3) {
            return matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1])
                 - matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0])
                 + matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);
        }

        if (n === 4) {
            // Expansión por cofactores para 4x4
            let det = 0;
            for (let i = 0; i < 4; i++) {
                const minor = this.getMinor(matrix, 0, i);
                const cofactor = Math.pow(-1, i) * this.calculateDeterminant(minor);
                det += matrix[0][i] * cofactor;
            }
            return det;
        }

        // Para matrices más grandes, usar aproximación
        return this.approximateDeterminant(matrix);
    }

    /**
     * Obtiene menor de una matriz
     */
    getMinor(matrix, row, col) {
        const n = matrix.length;
        const minor = [];

        for (let i = 0; i < n; i++) {
            if (i === row) continue;
            const newRow = [];
            for (let j = 0; j < n; j++) {
                if (j === col) continue;
                newRow.push(matrix[i][j]);
            }
            minor.push(newRow);
        }

        return minor;
    }

    /**
     * Aproxima determinante para matrices grandes
     */
    approximateDeterminant(matrix) {
        const n = matrix.length;
        let product = 1;

        // Producto de elementos diagonales
        for (let i = 0; i < n; i++) {
            product *= matrix[i][i];
        }

        return product;
    }

    /**
     * Crea matriz identidad
     */
    createIdentityMatrix(n) {
        const identity = this.createMatrix(n, n);
        for (let i = 0; i < n; i++) {
            identity[i][i] = 1;
        }
        return identity;
    }

    /**
     * Crea matriz inicializada en ceros
     */
    createMatrix(rows, cols) {
        return Array.from({ length: rows }, () => Array(cols).fill(0));
    }

    /**
     * Clona una matriz
     */
    cloneMatrix(matrix) {
        return matrix.map(row => [...row]);
    }

    /**
     * Calcula norma euclidiana de un vector
     */
    vectorNorm(vector) {
        return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    }

    /**
     * Multiplica matriz por vector
     */
    multiplyMatrixVector(matrix, vector) {
        const result = new Array(matrix.length);
        
        for (let i = 0; i < matrix.length; i++) {
            result[i] = 0;
            for (let j = 0; j < vector.length; j++) {
                result[i] += matrix[i][j] * vector[j];
            }
        }

        return result;
    }

    /**
     * Mejora la solución usando refinamiento iterativo
     */
    iterativeRefinement(A, b, x0, maxRefinements = 3) {
        let x = [...x0];

        for (let iter = 0; iter < maxRefinements; iter++) {
            // Calcular residual r = b - Ax
            const Ax = this.multiplyMatrixVector(A, x);
            const r = b.map((bi, i) => bi - Ax[i]);

            // Resolver A * dx = r
            const dxSolution = this.gaussianElimination(A, r);
            if (!dxSolution.isValid) break;

            // Actualizar solución x = x + dx
            for (let i = 0; i < x.length; i++) {
                x[i] += dxSolution.values[i];
            }

            // Verificar mejora
            const newResidual = this.calculateResidual(A, b, x);
            if (newResidual < this.tolerance) break;
        }

        return x;
    }

    /**
     * Configura parámetros del solucionador
     */
    configure(options) {
        if (options.tolerance !== undefined) {
            this.tolerance = Math.max(1e-15, Math.min(1e-3, options.tolerance));
        }
        if (options.maxIterations !== undefined) {
            this.maxIterations = Math.max(10, Math.min(10000, options.maxIterations));
        }
        if (options.debugMode !== undefined) {
            this.debugMode = Boolean(options.debugMode);
        }
    }

    /**
     * Obtiene estadísticas del solucionador
     */
    getStatistics() {
        return {
            tolerance: this.tolerance,
            maxIterations: this.maxIterations,
            debugMode: this.debugMode
        };
    }
} (sustitución hacia adelante)
            const y = new Array(n);
            for (let i = 0; i < n; i++) {
                y[i] = b[i];
                for (let j = 0; j < i; j++) {
                    y[i] -= L[i][j] * y[j];
                }
            }

            // Resolver Ux = y (sustitución hacia atrás)
            const x = new Array(n);
            for (let i = n - 1; i >= 0; i--) {
                x[i] = y[i];
                for (let j = i + 1; j < n; j++) {
                    x[i] -= U[i][j] * x[j];
                }
                x[i] /= U[i][i];
            }

            return {
                isValid: true,
                values: x,
                method: 'lu_decomposition',
                decomposition: { L, U }
            };

        } catch (error) {
            return {
                isValid: false,
                error: `Error en descomposición LU: ${error.message}`,
                values: new Array(n).fill(0)
            };
        }
    }

    /**
     * Descomposición de Cholesky (para matrices simétricas definidas positivas)
     */
    choleskyDecomposition(A, b) {
        const n = A.length;

        try {
            // Crear matriz L (triangular inferior)
            const L = this.createMatrix(n, n);

            // Descomposición de Cholesky: A = L * L^T
            for (let i = 0; i < n; i++) {
                for (let j = 0; j <= i; j++) {
                    if (i === j) {
                        // Elemento diagonal
                        let sum = 0;
                        for (let k = 0; k < j; k++) {
                            sum += L[j][k] * L[j][k];
                        }
                        L[j][j] = Math.sqrt(A[j][j] - sum);
                        
                        if (L[j][j] <= 0) {
                            throw new Error('Matriz no es definida positiva');
                        }
                    } else {
                        // Elemento bajo la diagonal
                        let sum = 0;
                        for (let k = 0; k < j; k++) {
                            sum += L[i][k] * L[j][k];
                        }
                        L[i][j] = (A[i][j] - sum) / L[j][j];
                    }
                }
            }

            // Resolver Ly = b
            const y