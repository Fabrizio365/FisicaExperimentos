/**
 * Constructor de matrices para análisis de circuitos
 * Crea matrices de incidencia, admitancia y sistemas de ecuaciones
 */
class CircuitMatrixBuilder {
    constructor() {
        this.tolerance = 1e-12;
        this.debugMode = false;
    }

    /**
     * Construye todas las matrices necesarias para el análisis
     */
    buildSystemMatrices(circuit, nodeAnalysis, method) {
        try {
            console.log(`🧮 Construyendo matrices para método: ${method}`);

            const matrices = {
                isValid: true,
                method: method,
                incidenceMatrix: null,
                admittanceMatrix: null,
                systemMatrix: null,
                rightHandSide: null,
                nodeIndexMap: new Map(),
                branchIndexMap: new Map(),
                dimensions: {},
                conditioning: {}
            };

            // Crear mapeos de índices
            this.createIndexMappings(nodeAnalysis, matrices);

            // Construir según el método seleccionado
            switch (method) {
                case 'nodal':
                case 'nodal_modified':
                    this.buildNodalMatrices(circuit, nodeAnalysis, matrices);
                    break;
                
                case 'mesh':
                case 'mesh_modified':
                    this.buildMeshMatrices(circuit, nodeAnalysis, matrices);
                    break;
                
                case 'series':
                    this.buildSeriesMatrices(circuit, nodeAnalysis, matrices);
                    break;
                
                case 'parallel':
                    this.buildParallelMatrices(circuit, nodeAnalysis, matrices);
                    break;
                
                case 'ladder':
                    this.buildLadderMatrices(circuit, nodeAnalysis, matrices);
                    break;
                
                default:
                    return { isValid: false, error: `Método no soportado: ${method}` };
            }

            // Verificar condicionamiento de matrices
            this.checkMatrixConditioning(matrices);

            console.log(`✅ Matrices construidas: ${matrices.dimensions.rows}x${matrices.dimensions.cols}`);
            return matrices;

        } catch (error) {
            console.error('❌ Error construyendo matrices:', error);
            return {
                isValid: false,
                error: `Error en construcción de matrices: ${error.message}`
            };
        }
    }

    /**
     * Crea mapeos de índices para nodos y ramas
     */
    createIndexMappings(nodeAnalysis, matrices) {
        // Mapeo de nodos (excluyendo ground para análisis nodal)
        let nodeIndex = 0;
        const groundNode = nodeAnalysis.nodes.find(node => node.isGround);
        const groundNodeId = groundNode ? groundNode.id : null;

        nodeAnalysis.nodes.forEach(node => {
            if (node.id !== groundNodeId) {
                matrices.nodeIndexMap.set(node.id, nodeIndex++);
            }
        });

        // Mapeo de ramas
        nodeAnalysis.branches.forEach((branch, index) => {
            matrices.branchIndexMap.set(branch.id, index);
        });

        matrices.groundNodeId = groundNodeId;
        matrices.nodeCount = matrices.nodeIndexMap.size;
        matrices.branchCount = matrices.branchIndexMap.size;
    }

    /**
     * Construye matrices para análisis nodal
     */
    buildNodalMatrices(circuit, nodeAnalysis, matrices) {
        const n = matrices.nodeCount; // Número de nodos (sin ground)
        
        console.log('⚡ Construyendo matrices para análisis nodal...');

        // Matriz de admitancia G [n x n]
        matrices.admittanceMatrix = this.createMatrix(n, n);
        
        // Vector de corrientes inyectadas I [n x 1]
        matrices.rightHandSide = new Array(n).fill(0);

        // Llenar matriz de admitancia y vector de corrientes
        nodeAnalysis.branches.forEach(branch => {
            this.addBranchToNodalMatrix(branch, matrices, nodeAnalysis);
        });

        // Manejar fuentes de voltaje (análisis nodal modificado)
        const voltageSourceCount = this.handleVoltageSourcesNodal(circuit, nodeAnalysis, matrices);

        // La matriz del sistema es la matriz de admitancia (para análisis nodal puro)
        matrices.systemMatrix = matrices.admittanceMatrix;
        
        matrices.dimensions = {
            rows: n,
            cols: n,
            variables: n,
            voltageSourceCount: voltageSourceCount
        };

        this.logMatrix('Matriz de Admitancia', matrices.admittanceMatrix);
        this.logVector('Vector de Corrientes', matrices.rightHandSide);
    }

    /**
     * Añade una rama a la matriz nodal
     */
    addBranchToNodalMatrix(branch, matrices, nodeAnalysis) {
        const startNodeIndex = matrices.nodeIndexMap.get(branch.startNodeId);
        const endNodeIndex = matrices.nodeIndexMap.get(branch.endNodeId);

        // Calcular admitancia de la rama
        const admittance = this.calculateAdmittance(branch.impedance);

        // Solo procesar si la admitancia es finita
        if (!isFinite(admittance.real)) return;

        const G = matrices.admittanceMatrix;
        const I = matrices.rightHandSide;

        // Caso 1: Ambos nodos son internos (no ground)
        if (startNodeIndex !== undefined && endNodeIndex !== undefined) {
            // Términos diagonales (auto-admitancia)
            G[startNodeIndex][startNodeIndex] += admittance.real;
            G[endNodeIndex][endNodeIndex] += admittance.real;
            
            // Términos cruzados (mutua-admitancia)
            G[startNodeIndex][endNodeIndex] -= admittance.real;
            G[endNodeIndex][startNodeIndex] -= admittance.real;
        }
        // Caso 2: Un nodo es ground
        else if (startNodeIndex !== undefined) {
            // Solo el nodo de inicio es interno
            G[startNodeIndex][startNodeIndex] += admittance.real;
        }
        else if (endNodeIndex !== undefined) {
            // Solo el nodo final es interno
            G[endNodeIndex][endNodeIndex] += admittance.real;
        }

        // Manejar fuentes de corriente
        if (branch.type === 'current') {
            const current = branch.component.value;
            
            if (startNodeIndex !== undefined) {
                I[startNodeIndex] -= current; // Corriente sale del nodo
            }
            if (endNodeIndex !== undefined) {
                I[endNodeIndex] += current; // Corriente entra al nodo
            }
        }
    }

    /**
     * Maneja fuentes de voltaje en análisis nodal
     */
    handleVoltageSourcesNodal(circuit, nodeAnalysis, matrices) {
        const voltageSources = nodeAnalysis.branches.filter(b => b.type === 'voltage');
        
        if (voltageSources.length === 0) return 0;

        console.log(`🔋 Manejando ${voltageSources.length} fuentes de voltaje...`);

        // Para análisis nodal modificado, expandir el sistema
        const originalSize = matrices.nodeCount;
        const newSize = originalSize + voltageSources.length;

        // Expandir matriz de admitancia
        const expandedMatrix = this.createMatrix(newSize, newSize);
        const expandedRHS = new Array(newSize).fill(0);

        // Copiar matriz original
        for (let i = 0; i < originalSize; i++) {
            for (let j = 0; j < originalSize; j++) {
                expandedMatrix[i][j] = matrices.admittanceMatrix[i][j];
            }
            expandedRHS[i] = matrices.rightHandSide[i];
        }

        // Añadir ecuaciones para fuentes de voltaje
        voltageSources.forEach((source, idx) => {
            const sourceRow = originalSize + idx;
            const startNodeIndex = matrices.nodeIndexMap.get(source.startNodeId);
            const endNodeIndex = matrices.nodeIndexMap.get(source.endNodeId);

            // Ecuación de restricción: V_start - V_end = V_source
            if (startNodeIndex !== undefined) {
                expandedMatrix[sourceRow][startNodeIndex] = 1;
                expandedMatrix[startNodeIndex][sourceRow] = 1;
            }
            if (endNodeIndex !== undefined) {
                expandedMatrix[sourceRow][endNodeIndex] = -1;
                expandedMatrix[endNodeIndex][sourceRow] = -1;
            }

            expandedRHS[sourceRow] = source.component.value;
        });

        matrices.systemMatrix = expandedMatrix;
        matrices.rightHandSide = expandedRHS;
        matrices.dimensions.rows = newSize;
        matrices.dimensions.cols = newSize;

        return voltageSources.length;
    }

    /**
     * Construye matrices para análisis de mallas
     */
    buildMeshMatrices(circuit, nodeAnalysis, matrices) {
        console.log('🔄 Construyendo matrices para análisis de mallas...');

        const meshes = nodeAnalysis.topology.meshes;
        const m = meshes.length; // Número de mallas independientes

        if (m === 0) {
            throw new Error('No se encontraron mallas independientes para análisis');
        }

        // Matriz de impedancia Z [m x m]
        matrices.systemMatrix = this.createMatrix(m, m);
        
        // Vector de voltajes E [m x 1]
        matrices.rightHandSide = new Array(m).fill(0);

        // Construir matriz de impedancia de mallas
        this.buildMeshImpedanceMatrix(meshes, nodeAnalysis.branches, matrices);

        // Construir vector de voltajes de mallas
        this.buildMeshVoltageVector(meshes, nodeAnalysis.branches, matrices);

        matrices.dimensions = {
            rows: m,
            cols: m,
            variables: m,
            meshCount: m
        };

        this.logMatrix('Matriz de Impedancia de Mallas', matrices.systemMatrix);
        this.logVector('Vector de Voltajes', matrices.rightHandSide);
    }

    /**
     * Construye la matriz de impedancia para análisis de mallas
     */
    buildMeshImpedanceMatrix(meshes, branches, matrices) {
        const Z = matrices.systemMatrix;

        meshes.forEach((mesh_i, i) => {
            meshes.forEach((mesh_j, j) => {
                if (i === j) {
                    // Elemento diagonal: suma de todas las impedancias en la malla i
                    Z[i][j] = mesh_i.branches.reduce((sum, branch) => {
                        return sum + (branch.impedance.real || 0);
                    }, 0);
                } else {
                    // Elemento no diagonal: impedancia compartida entre mallas i y j
                    const sharedBranches = this.findSharedBranches(mesh_i, mesh_j);
                    Z[i][j] = sharedBranches.reduce((sum, branch) => {
                        return sum + (branch.impedance.real || 0);
                    }, 0);
                }
            });
        });
    }

    /**
     * Encuentra ramas compartidas entre dos mallas
     */
    findSharedBranches(mesh1, mesh2) {
        return mesh1.branches.filter(branch1 =>
            mesh2.branches.some(branch2 => branch1.id === branch2.id)
        );
    }

    /**
     * Construye el vector de voltajes para análisis de mallas
     */
    buildMeshVoltageVector(meshes, branches, matrices) {
        const E = matrices.rightHandSide;

        meshes.forEach((mesh, i) => {
            E[i] = mesh.branches.reduce((sum, branch) => {
                if (branch.type === 'voltage') {
                    // Determinar polaridad de la fuente en la malla
                    const polarity = this.getVoltageSourcePolarity(branch, mesh);
                    return sum + polarity * branch.component.value;
                }
                return sum;
            }, 0);
        });
    }

    /**
     * Determina la polaridad de una fuente de voltaje en una malla
     */
    getVoltageSourcePolarity(voltageSource, mesh) {
        // Simplificación: asumir polaridad positiva
        // En implementación completa, se determinaría según la dirección de la malla
        return 1;
    }

    /**
     * Construye matrices para circuitos en serie
     */
    buildSeriesMatrices(circuit, nodeAnalysis, matrices) {
        console.log('🔗 Construyendo matrices para circuito en serie...');

        const voltageSources = nodeAnalysis.branches.filter(b => b.type === 'voltage');
        const resistors = nodeAnalysis.branches.filter(b => b.type === 'resistor');

        if (voltageSources.length === 0) {
            throw new Error('Circuito serie sin fuente de voltaje');
        }

        // Para circuito serie, solo necesitamos resolver I = V_total / R_total
        const totalVoltage = voltageSources.reduce((sum, vs) => sum + vs.component.value, 0);
        const totalResistance = resistors.reduce((sum, r) => sum + r.impedance.real, 0);

        // Sistema 1x1 trivial
        matrices.systemMatrix = [[totalResistance]];
        matrices.rightHandSide = [totalVoltage];

        matrices.dimensions = {
            rows: 1,
            cols: 1,
            variables: 1,
            totalResistance: totalResistance,
            totalVoltage: totalVoltage
        };
    }

    /**
     * Construye matrices para circuitos en paralelo
     */
    buildParallelMatrices(circuit, nodeAnalysis, matrices) {
        console.log('🔀 Construyendo matrices para circuito en paralelo...');

        const voltageSources = nodeAnalysis.branches.filter(b => b.type === 'voltage');
        const resistors = nodeAnalysis.branches.filter(b => b.type === 'resistor');

        if (voltageSources.length === 0) {
            throw new Error('Circuito paralelo sin fuente de voltaje');
        }

        const sourceVoltage = voltageSources[0].component.value;

        // Para circuito paralelo, el voltaje es el mismo en todas las ramas
        // Sistema simple: cada corriente = V / R
        const n = resistors.length;
        matrices.systemMatrix = this.createMatrix(n, n);
        matrices.rightHandSide = new Array(n).fill(sourceVoltage);

        // Matriz diagonal con resistencias
        resistors.forEach((resistor, i) => {
            matrices.systemMatrix[i][i] = resistor.impedance.real || 1;
        });

        matrices.dimensions = {
            rows: n,
            cols: n,
            variables: n,
            sourceVoltage: sourceVoltage
        };
    }

    /**
     * Construye matrices para circuitos escalera
     */
    buildLadderMatrices(circuit, nodeAnalysis, matrices) {
        console.log('🪜 Construyendo matrices para circuito escalera...');

        // Para circuitos escalera, usar análisis nodal estándar
        // pero optimizado para la estructura específica
        this.buildNodalMatrices(circuit, nodeAnalysis, matrices);

        // Marcar como método escalera para optimizaciones posteriores
        matrices.method = 'ladder';
        matrices.dimensions.isLadder = true;
    }

    /**
     * Calcula la admitancia desde impedancia
     */
    calculateAdmittance(impedance) {
        const real = impedance.real || 0;
        const imag = impedance.imaginary || 0;
        const denominator = real * real + imag * imag;

        if (denominator < this.tolerance) {
            return { real: Infinity, imaginary: 0 };
        }

        return {
            real: real / denominator,
            imaginary: -imag / denominator
        };
    }

    /**
     * Construye matriz de incidencia A [nodos x ramas]
     */
    buildIncidenceMatrix(nodeAnalysis, matrices) {
        const nodes = nodeAnalysis.nodes.filter(node => !node.isGround);
        const branches = nodeAnalysis.branches;
        
        const n = nodes.length;
        const b = branches.length;

        matrices.incidenceMatrix = this.createMatrix(n, b);
        const A = matrices.incidenceMatrix;

        branches.forEach((branch, branchIndex) => {
            const startNodeIndex = matrices.nodeIndexMap.get(branch.startNodeId);
            const endNodeIndex = matrices.nodeIndexMap.get(branch.endNodeId);

            if (startNodeIndex !== undefined) {
                A[startNodeIndex][branchIndex] = 1;
            }
            if (endNodeIndex !== undefined) {
                A[endNodeIndex][branchIndex] = -1;
            }
        });

        return matrices.incidenceMatrix;
    }

    /**
     * Verifica el condicionamiento de las matrices
     */
    checkMatrixConditioning(matrices) {
        if (!matrices.systemMatrix) return;

        const matrix = matrices.systemMatrix;
        const n = matrix.length;

        // Calcular número de condición aproximado
        const conditioning = {
            determinant: this.calculateDeterminant(matrix),
            rank: this.estimateRank(matrix),
            isDiagonallyDominant: this.checkDiagonalDominance(matrix),
            isSymmetric: this.checkSymmetry(matrix),
            conditionNumber: null
        };

        // Verificar singularidad
        if (Math.abs(conditioning.determinant) < this.tolerance) {
            conditioning.isSingular = true;
            conditioning.warning = 'Matriz singular o cerca de singular';
        }

        // Verificar dominancia diagonal
        if (!conditioning.isDiagonallyDominant) {
            conditioning.warning = 'Matriz no es diagonalmente dominante - posible inestabilidad numérica';
        }

        matrices.conditioning = conditioning;

        if (conditioning.warning) {
            console.warn('⚠️ Advertencia de condicionamiento:', conditioning.warning);
        }
    }

    /**
     * Calcula determinante para matrices pequeñas
     */
    calculateDeterminant(matrix) {
        const n = matrix.length;
        
        if (n === 1) return matrix[0][0];
        if (n === 2) return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
        if (n === 3) {
            return matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1])
                 - matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0])
                 + matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);
        }

        // Para matrices más grandes, usar aproximación
        return this.approximateDeterminant(matrix);
    }

    /**
     * Aproxima el determinante para matrices grandes
     */
    approximateDeterminant(matrix) {
        const n = matrix.length;
        let product = 1;

        // Producto de elementos diagonales como aproximación
        for (let i = 0; i < n; i++) {
            product *= matrix[i][i];
        }

        return product;
    }

    /**
     * Estima el rango de la matriz
     */
    estimateRank(matrix) {
        const n = matrix.length;
        let rank = 0;

        for (let i = 0; i < n; i++) {
            // Contar filas no nulas
            const rowSum = matrix[i].reduce((sum, val) => sum + Math.abs(val), 0);
            if (rowSum > this.tolerance) {
                rank++;
            }
        }

        return rank;
    }

    /**
     * Verifica dominancia diagonal
     */
    checkDiagonalDominance(matrix) {
        const n = matrix.length;

        for (let i = 0; i < n; i++) {
            const diagonal = Math.abs(matrix[i][i]);
            const offDiagonalSum = matrix[i].reduce((sum, val, j) => 
                i !== j ? sum + Math.abs(val) : sum, 0
            );

            if (diagonal < offDiagonalSum) {
                return false;
            }
        }

        return true;
    }

    /**
     * Verifica simetría de la matriz
     */
    checkSymmetry(matrix) {
        const n = matrix.length;

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (Math.abs(matrix[i][j] - matrix[j][i]) > this.tolerance) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Crea matriz inicializada en ceros
     */
    createMatrix(rows, cols) {
        return Array.from({ length: rows }, () => Array(cols).fill(0));
    }

    /**
     * Crea vector inicializado en ceros
     */
    createVector(size) {
        return new Array(size).fill(0);
    }

    /**
     * Clona una matriz
     */
    cloneMatrix(matrix) {
        return matrix.map(row => [...row]);
    }

    /**
     * Multiplica matriz por vector
     */
    multiplyMatrixVector(matrix, vector) {
        const rows = matrix.length;
        const result = new Array(rows).fill(0);

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < vector.length; j++) {
                result[i] += matrix[i][j] * vector[j];
            }
        }

        return result;
    }

    /**
     * Transpone una matriz
     */
    transpose(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const transposed = this.createMatrix(cols, rows);

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                transposed[j][i] = matrix[i][j];
            }
        }

        return transposed;
    }

    /**
     * Registra matriz en consola (para debug)
     */
    logMatrix(name, matrix) {
        if (!this.debugMode) return;

        console.log(`\n📊 ${name}:`);
        matrix.forEach((row, i) => {
            const formattedRow = row.map(val => val.toFixed(6).padStart(10)).join(' ');
            console.log(`[${i}] ${formattedRow}`);
        });
    }

    /**
     * Registra vector en consola (para debug)
     */
    logVector(name, vector) {
        if (!this.debugMode) return;

        console.log(`\n📋 ${name}:`);
        const formattedVector = vector.map((val, i) => 
            `[${i}] ${val.toFixed(6)}`
        ).join('\n');
        console.log(formattedVector);
    }

    /**
     * Valida consistencia dimensional
     */
    validateDimensions(matrices) {
        const { systemMatrix, rightHandSide } = matrices;

        if (!systemMatrix || !rightHandSide) {
            throw new Error('Matrices del sistema no inicializadas');
        }

        const matrixRows = systemMatrix.length;
        const matrixCols = systemMatrix[0].length;
        const vectorLength = rightHandSide.length;

        if (matrixRows !== matrixCols) {
            throw new Error(`Matriz del sistema no es cuadrada: ${matrixRows}x${matrixCols}`);
        }

        if (matrixRows !== vectorLength) {
            throw new Error(`Dimensiones inconsistentes: matriz ${matrixRows}x${matrixCols}, vector ${vectorLength}`);
        }

        return true;
    }

    /**
     * Optimiza matriz para mejor condicionamiento
     */
    optimizeMatrix(matrices) {
        if (!matrices.systemMatrix) return;

        // Escalado de filas para mejorar condicionamiento
        const matrix = matrices.systemMatrix;
        const rhs = matrices.rightHandSide;
        const n = matrix.length;

        for (let i = 0; i < n; i++) {
            // Encontrar el elemento más grande en la fila
            const maxElement = Math.max(...matrix[i].map(Math.abs));
            
            if (maxElement > this.tolerance) {
                // Escalar fila
                for (let j = 0; j < n; j++) {
                    matrix[i][j] /= maxElement;
                }
                rhs[i] /= maxElement;
            }
        }
    }

    /**
     * Extrae submatriz
     */
    extractSubmatrix(matrix, rowIndices, colIndices) {
        return rowIndices.map(i => 
            colIndices.map(j => matrix[i][j])
        );
    }

    /**
     * Calcula norma de matriz (Frobenius)
     */
    matrixNorm(matrix) {
        let sum = 0;
        matrix.forEach(row => {
            row.forEach(val => {
                sum += val * val;
            });
        });
        return Math.sqrt(sum);
    }

    /**
     * Verifica si la matriz es definida positiva
     */
    isPositiveDefinite(matrix) {
        const n = matrix.length;
        
        // Verificar que todos los elementos diagonales sean positivos
        for (let i = 0; i < n; i++) {
            if (matrix[i][i] <= 0) return false;
        }

        // Verificar criterio de Sylvester (simplificado)
        for (let k = 1; k <= n; k++) {
            const submatrix = this.extractSubmatrix(matrix, 
                Array.from({length: k}, (_, i) => i),
                Array.from({length: k}, (_, i) => i)
            );
            
            const det = this.calculateDeterminant(submatrix);
            if (det <= 0) return false;
        }

        return true;
    }
}
        