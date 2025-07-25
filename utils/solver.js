/**
 * Coordinador principal del sistema de análisis de circuitos
 * Orquesta los diferentes módulos especializados
 */
class CircuitAnalyzer {
    constructor() {
        this.tolerance = 1e-9;
        this.maxIterations = 1000;
        this.debugMode = false;
        
        // Instanciar módulos especializados
        this.nodeAnalyzer = new NodeAnalyzer();
        this.matrixBuilder = new CircuitMatrixBuilder();
        this.equationSolver = new EquationSolver();
        this.ohmLawHelper = new OhmLawHelper();
        
        // Cache para optimización
        this.analysisCache = new Map();
        this.lastCircuitHash = null;
    }

    /**
     * Método principal para analizar un circuito completo
     */
    async analyzeCircuit(circuit) {
        try {
            // Generar hash del circuito para cache
            const circuitHash = this.generateCircuitHash(circuit);
            
            // Verificar cache
            if (this.analysisCache.has(circuitHash)) {
                return { ...this.analysisCache.get(circuitHash), fromCache: true };
            }

            console.log('🔍 Iniciando análisis de circuito...');

            // Paso 1: Validar estructura del circuito
            const validation = await this.validateCircuit(circuit);
            if (!validation.isValid) {
                return { isValid: false, error: validation.error, warnings: validation.warnings };
            }

            // Paso 2: Análisis de nodos y topología
            console.log('📊 Analizando nodos y topología...');
            const nodeAnalysis = this.nodeAnalyzer.analyzeNodes(circuit);
            if (!nodeAnalysis.isValid) {
                return { isValid: false, error: nodeAnalysis.error };
            }

            // Paso 3: Determinar método de análisis óptimo
            const analysisMethod = this.selectOptimalMethod(nodeAnalysis);
            console.log(`⚡ Método seleccionado: ${analysisMethod}`);

            // Paso 4: Construir matrices del sistema
            const matrices = this.matrixBuilder.buildSystemMatrices(circuit, nodeAnalysis, analysisMethod);
            if (!matrices.isValid) {
                return { isValid: false, error: matrices.error };
            }

            // Paso 5: Resolver sistema de ecuaciones
            const solution = this.equationSolver.solve(matrices);
            if (!solution.isValid) {
                return { isValid: false, error: solution.error };
            }

            // Paso 6: Procesar y calcular valores finales
            const results = this.processResults(solution, circuit, nodeAnalysis, analysisMethod);

            // Paso 7: Validar resultados físicos
            const validation2 = this.validateResults(results, circuit);
            if (!validation2.isValid) {
                results.warnings = [...(results.warnings || []), ...validation2.warnings];
            }

            // Guardar en cache
            this.analysisCache.set(circuitHash, results);
            this.lastCircuitHash = circuitHash;

            console.log('✅ Análisis completado exitosamente');
            return results;

        } catch (error) {
            console.error('❌ Error en análisis de circuito:', error);
            return {
                isValid: false,
                error: `Error interno del analizador: ${error.message}`,
                stack: this.debugMode ? error.stack : undefined
            };
        }
    }

    /**
     * Valida la estructura básica del circuito
     */
    async validateCircuit(circuit) {
        const errors = [];
        const warnings = [];

        // Validaciones básicas
        if (!circuit || !circuit.components || !circuit.wires) {
            errors.push('Estructura de circuito inválida');
            return { isValid: false, error: errors.join('; ') };
        }

        if (circuit.components.length === 0) {
            errors.push('El circuito no contiene componentes');
        }

        // Verificar tipos de componentes necesarios
        const voltageSources = circuit.components.filter(c => c.type === 'voltage');
        const currentSources = circuit.components.filter(c => c.type === 'current');
        const resistors = circuit.components.filter(c => c.type === 'resistor');
        const grounds = circuit.components.filter(c => c.type === 'ground');

        if (voltageSources.length === 0 && currentSources.length === 0) {
            errors.push('El circuito debe tener al menos una fuente de voltaje o corriente');
        }

        if (resistors.length === 0) {
            warnings.push('Circuito sin resistencias: puede tener comportamiento inestable');
        }

        if (grounds.length === 0) {
            warnings.push('No se encontró referencia a tierra: se asignará automáticamente');
        }

        if (grounds.length > 1) {
            warnings.push('Múltiples referencias a tierra detectadas');
        }

        // Validar valores de componentes
        circuit.components.forEach(component => {
            const componentValidation = this.validateComponent(component);
            if (!componentValidation.isValid) {
                errors.push(`${component.label}: ${componentValidation.error}`);
            }
            warnings.push(...componentValidation.warnings);
        });

        // Verificar conectividad básica
        const connectivity = this.nodeAnalyzer.checkBasicConnectivity(circuit);
        if (!connectivity.isConnected) {
            errors.push('Circuito contiene componentes desconectados');
        }

        return {
            isValid: errors.length === 0,
            error: errors.join('; '),
            warnings: warnings.filter(w => w && w.length > 0),
            componentCounts: {
                voltageSources: voltageSources.length,
                currentSources: currentSources.length,
                resistors: resistors.length,
                grounds: grounds.length,
                total: circuit.components.length
            }
        };
    }

    /**
     * Valida un componente individual
     */
    validateComponent(component) {
        const errors = [];
        const warnings = [];

        // Validar valor numérico
        if (typeof component.value !== 'number' || isNaN(component.value)) {
            errors.push('Valor no es un número válido');
        }

        // Validaciones específicas por tipo
        switch (component.type) {
            case 'resistor':
                if (component.value <= 0) {
                    errors.push('La resistencia debe ser mayor que cero');
                }
                if (component.value < 0.1) {
                    warnings.push('Resistencia muy baja: puede causar problemas numéricos');
                }
                if (component.value > 1e12) {
                    warnings.push('Resistencia muy alta: puede causar problemas numéricos');
                }
                break;

            case 'voltage':
                if (Math.abs(component.value) > 1000) {
                    warnings.push('Voltaje muy alto: verificar seguridad');
                }
                break;

            case 'current':
                if (Math.abs(component.value) > 100) {
                    warnings.push('Corriente muy alta: verificar seguridad');
                }
                break;

            case 'capacitor':
                if (component.value <= 0) {
                    errors.push('La capacitancia debe ser mayor que cero');
                }
                break;

            case 'inductor':
                if (component.value <= 0) {
                    errors.push('La inductancia debe ser mayor que cero');
                }
                break;
        }

        return {
            isValid: errors.length === 0,
            error: errors.join('; '),
            warnings: warnings
        };
    }

    /**
     * Selecciona el método de análisis más eficiente
     */
    selectOptimalMethod(nodeAnalysis) {
        const nodeCount = nodeAnalysis.nodeCount;
        const branchCount = nodeAnalysis.branchCount;
        const voltageSourceCount = nodeAnalysis.voltageSourceCount;
        const currentSourceCount = nodeAnalysis.currentSourceCount;

        // Detectar configuraciones especiales
        if (nodeAnalysis.topology.isSeriesCircuit) {
            return 'series';
        }

        if (nodeAnalysis.topology.isParallelCircuit) {
            return 'parallel';
        }

        if (nodeAnalysis.topology.isLadderCircuit) {
            return 'ladder';
        }

        // Para circuitos generales, elegir entre nodal y mallas
        const nodalEquations = nodeCount - 1; // Excluyendo ground
        const meshEquations = branchCount - nodeCount + 1; // Número de mallas independientes

        // Considerar fuentes de voltaje (complican análisis nodal)
        const adjustedNodalComplexity = nodalEquations + voltageSourceCount * 2;
        const adjustedMeshComplexity = meshEquations + currentSourceCount * 2;

        if (adjustedNodalComplexity <= adjustedMeshComplexity) {
            return voltageSourceCount > 0 ? 'nodal_modified' : 'nodal';
        } else {
            return currentSourceCount > 0 ? 'mesh_modified' : 'mesh';
        }
    }

    /**
     * Procesa los resultados de la solución
     */
    processResults(solution, circuit, nodeAnalysis, method) {
        console.log('🔄 Procesando resultados de la simulación...');

        const results = {
            isValid: true,
            method: method,
            timestamp: new Date(),
            nodeVoltages: {},
            branchCurrents: {},
            componentValues: {},
            currentFlow: {},
            voltageDrops: {},
            powerAnalysis: {},
            circuitType: nodeAnalysis.topology.description,
            totalResistance: 0,
            totalCurrent: 0,
            totalPower: 0,
            sourceVoltage: 0,
            efficiency: 0,
            warnings: []
        };

        // Procesar voltajes de nodo
        if (solution.nodeVoltages) {
            nodeAnalysis.nodes.forEach((node, index) => {
                results.nodeVoltages[node.id] = solution.nodeVoltages[index] || 0;
            });
        }

        // Procesar corrientes de rama
        if (solution.branchCurrents) {
            nodeAnalysis.branches.forEach((branch, index) => {
                const current = solution.branchCurrents[index] || 0;
                results.branchCurrents[branch.id] = current;

                // Asignar corrientes a componentes y cables
                if (branch.componentId) {
                    this.assignCurrentToComponent(branch.componentId, current, circuit, results);
                }

                if (branch.wireId) {
                    results.currentFlow[branch.wireId] = current;
                }
            });
        }

        // Calcular potencias usando OhmLawHelper
        results.powerAnalysis = this.ohmLawHelper.calculatePowerAnalysis(results, circuit);

        // Calcular métricas totales
        this.calculateTotalMetrics(results, circuit);

        // Validar balance de potencia
        const powerBalance = this.ohmLawHelper.validatePowerBalance(results.powerAnalysis);
        if (Math.abs(powerBalance.error) > 0.01) {
            results.warnings.push(`Desbalance de potencia: ${powerBalance.error.toFixed(3)}W`);
        }

        return results;
    }

    /**
     * Asigna corriente calculada a un componente
     */
    assignCurrentToComponent(componentId, current, circuit, results) {
        const component = circuit.components.find(c => c.id === componentId);
        if (!component) return;

        // Calcular voltaje usando ley de Ohm
        const voltage = this.ohmLawHelper.calculateVoltage(component, current);
        const power = this.ohmLawHelper.calculatePower(voltage, current);

        results.componentValues[componentId] = {
            current: current,
            voltage: voltage,
            power: power,
            resistance: component.type === 'resistor' ? component.value : null,
            impedance: this.getComponentImpedance(component)
        };

        // Actualizar propiedades del componente para visualización
        component.current = current;
        component.voltage = voltage;
        component.power = power;
    }

    /**
     * Calcula métricas totales del circuito
     */
    calculateTotalMetrics(results, circuit) {
        // Resistencia total equivalente
        const resistors = circuit.components.filter(c => c.type === 'resistor');
        if (resistors.length > 0 && results.method === 'series') {
            results.totalResistance = resistors.reduce((sum, r) => sum + r.value, 0);
        } else if (resistors.length > 0 && results.method === 'parallel') {
            const totalAdmittance = resistors.reduce((sum, r) => sum + (1 / r.value), 0);
            results.totalResistance = totalAdmittance > 0 ? 1 / totalAdmittance : Infinity;
        }

        // Corriente y voltaje total
        const voltageSources = circuit.components.filter(c => c.type === 'voltage');
        if (voltageSources.length > 0) {
            results.sourceVoltage = voltageSources.reduce((sum, vs) => sum + vs.value, 0);
            
            // Buscar corriente de la fuente principal
            const mainSource = voltageSources[0];
            const sourceValues = results.componentValues[mainSource.id];
            if (sourceValues) {
                results.totalCurrent = Math.abs(sourceValues.current);
            }
        }

        // Potencia total
        results.totalPower = Object.values(results.componentValues)
            .reduce((sum, comp) => sum + Math.abs(comp.power || 0), 0);

        // Eficiencia (potencia útil / potencia total suministrada)
        if (results.powerAnalysis.totalSupplied > 0) {
            results.efficiency = (results.powerAnalysis.totalUseful / results.powerAnalysis.totalSupplied) * 100;
        }
    }

    /**
     * Valida que los resultados sean físicamente razonables
     */
    validateResults(results, circuit) {
        const warnings = [];

        // Verificar valores extremos
        Object.entries(results.componentValues).forEach(([id, values]) => {
            if (Math.abs(values.current) > 1000) {
                warnings.push(`Corriente muy alta en ${id}: ${values.current.toFixed(2)}A`);
            }

            if (Math.abs(values.voltage) > 10000) {
                warnings.push(`Voltaje muy alto en ${id}: ${values.voltage.toFixed(2)}V`);
            }

            if (Math.abs(values.power) > 100000) {
                warnings.push(`Potencia muy alta en ${id}: ${values.power.toFixed(2)}W`);
            }
        });

        // Verificar ley de Kirchhoff de corrientes en nodos
        const currentBalance = this.verifyKirchhoffCurrentLaw(results, circuit);
        if (!currentBalance.isValid) {
            warnings.push('Posible violación de la ley de Kirchhoff de corrientes');
        }

        return {
            isValid: warnings.length === 0,
            warnings: warnings
        };
    }

    /**
     * Verifica la ley de Kirchhoff de corrientes
     */
    verifyKirchhoffCurrentLaw(results, circuit) {
        // Implementación simplificada
        // En una implementación completa, verificaríamos que la suma de corrientes en cada nodo sea cero
        return { isValid: true };
    }

    /**
     * Obtiene la impedancia de un componente
     */
    getComponentImpedance(component, frequency = 0) {
        return this.ohmLawHelper.calculateImpedance(component, frequency);
    }

    /**
     * Genera hash único del circuito para cache
     */
    generateCircuitHash(circuit) {
        const circuitData = {
            components: circuit.components.map(c => ({
                type: c.type,
                value: c.value,
                id: c.id
            })),
            wires: circuit.wires.map(w => ({
                start: w.startComponent,
                end: w.endComponent,
                resistance: w.resistance
            }))
        };

        return this.simpleHash(JSON.stringify(circuitData));
    }

    /**
     * Función hash simple
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    /**
     * Análisis en dominio de frecuencia
     */
    async frequencyAnalysis(circuit, frequencies) {
        console.log('🌊 Iniciando análisis en frecuencia...');
        
        const results = {
            frequencies: frequencies,
            responses: [],
            isValid: true
        };

        for (const freq of frequencies) {
            try {
                // Crear copia del circuito con impedancias para esta frecuencia
                const freqCircuit = this.createFrequencyCircuit(circuit, freq);
                
                // Analizar con impedancias complejas
                const analysis = await this.analyzeCircuit(freqCircuit);
                
                if (analysis.isValid) {
                    results.responses.push({
                        frequency: freq,
                        magnitude: this.calculateMagnitudeResponse(analysis),
                        phase: this.calculatePhaseResponse(analysis),
                        impedance: this.calculateTotalImpedance(analysis)
                    });
                }
            } catch (error) {
                console.warn(`Error en frecuencia ${freq}Hz:`, error);
                results.responses.push({
                    frequency: freq,
                    magnitude: 0,
                    phase: 0,
                    impedance: { real: Infinity, imaginary: 0 }
                });
            }
        }

        return results;
    }

    /**
     * Crea circuito modificado para análisis en frecuencia
     */
    createFrequencyCircuit(circuit, frequency) {
        // Crear copia profunda del circuito
        const freqCircuit = JSON.parse(JSON.stringify(circuit));
        
        // Actualizar valores de componentes reactivos
        freqCircuit.components.forEach(component => {
            if (component.type === 'capacitor') {
                // Para capacitores, la impedancia es -j/(ωC)
                component.impedance = this.ohmLawHelper.calculateImpedance(component, frequency);
            } else if (component.type === 'inductor') {
                // Para inductores, la impedancia es jωL
                component.impedance = this.ohmLawHelper.calculateImpedance(component, frequency);
            }
        });

        return freqCircuit;
    }

    /**
     * Calcula respuesta en magnitud
     */
    calculateMagnitudeResponse(analysis) {
        // Implementación simplificada
        return analysis.totalCurrent || 0;
    }

    /**
     * Calcula respuesta en fase
     */
    calculatePhaseResponse(analysis) {
        // Implementación simplificada para análisis DC
        return 0;
    }

    /**
     * Calcula impedancia total
     */
    calculateTotalImpedance(analysis) {
        return {
            real: analysis.totalResistance || 0,
            imaginary: 0
        };
    }

    /**
     * Limpia cache y recursos
     */
    clearCache() {
        this.analysisCache.clear();
        this.lastCircuitHash = null;
        console.log('🧹 Cache del analizador limpiado');
    }

    /**
     * Obtiene estadísticas del analizador
     */
    getStatistics() {
        return {
            cacheSize: this.analysisCache.size,
            tolerance: this.tolerance,
            maxIterations: this.maxIterations,
            debugMode: this.debugMode
        };
    }

    /**
     * Configura parámetros del analizador
     */
    configure(options) {
        if (options.tolerance !== undefined) {
            this.tolerance = Math.max(1e-12, Math.min(1e-3, options.tolerance));
        }
        if (options.maxIterations !== undefined) {
            this.maxIterations = Math.max(10, Math.min(10000, options.maxIterations));
        }
        if (options.debugMode !== undefined) {
            this.debugMode = Boolean(options.debugMode);
        }
        if (options.clearCache) {
            this.clearCache();
        }
    }

    /**
     * Limpia recursos del analizador
     */
    dispose() {
        this.clearCache();
        this.nodeAnalyzer = null;
        this.matrixBuilder = null;
        this.equationSolver = null;
        this.ohmLawHelper = null;
        console.log('🔌 Analizador de circuitos desconectado');
    }
}