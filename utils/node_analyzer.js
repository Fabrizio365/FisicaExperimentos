/**
 * Analizador de nodos eléctricos y topología de circuitos
 * Identifica y analiza la estructura de conexiones del circuito
 */
class NodeAnalyzer {
    constructor() {
        this.tolerance = 10; // Tolerancia en píxeles para conexiones
        this.debugMode = false;
    }

    /**
     * Analiza todos los nodos del circuito y su topología
     */
    analyzeNodes(circuit) {
        try {
            console.log('🔍 Analizando estructura de nodos...');

            // Paso 1: Identificar nodos físicos
            const nodes = this.identifyPhysicalNodes(circuit);
            
            // Paso 2: Crear mapeo de nodos eléctricos
            const electricalNodes = this.createElectricalNodes(nodes, circuit);
            
            // Paso 3: Identificar ramas del circuito
            const branches = this.identifyBranches(circuit, electricalNodes);
            
            // Paso 4: Analizar topología
            const topology = this.analyzeTopology(electricalNodes, branches, circuit);
            
            // Paso 5: Validar estructura
            const validation = this.validateNodeStructure(electricalNodes, branches);

            const result = {
                isValid: validation.isValid,
                error: validation.error,
                nodes: electricalNodes,
                branches: branches,
                topology: topology,
                nodeCount: electricalNodes.length,
                branchCount: branches.length,
                voltageSourceCount: branches.filter(b => b.type === 'voltage').length,
                currentSourceCount: branches.filter(b => b.type === 'current').length,
                statistics: {
                    isolatedNodes: electricalNodes.filter(n => n.connections.length === 0).length,
                    junctionNodes: electricalNodes.filter(n => n.connections.length > 2).length,
                    terminalNodes: electricalNodes.filter(n => n.connections.length === 1).length
                }
            };

            console.log(`✅ Análisis de nodos completado: ${result.nodeCount} nodos, ${result.branchCount} ramas`);
            return result;

        } catch (error) {
            console.error('❌ Error en análisis de nodos:', error);
            return {
                isValid: false,
                error: `Error en análisis de nodos: ${error.message}`,
                nodes: [],
                branches: []
            };
        }
    }

    /**
     * Identifica nodos físicos basados en posiciones y conexiones
     */
    identifyPhysicalNodes(circuit) {
        const physicalNodes = new Map();
        let nodeIdCounter = 0;

        console.log('📍 Identificando nodos físicos...');

        // Procesar puntos de conexión de componentes
        circuit.components.forEach(component => {
            const connectionPoints = component.getConnectionPoints();
            
            connectionPoints.forEach((point, terminalIndex) => {
                const nodeKey = this.generateNodeKey(point.x, point.y);
                
                if (!physicalNodes.has(nodeKey)) {
                    physicalNodes.set(nodeKey, {
                        id: `node_${nodeIdCounter++}`,
                        x: point.x,
                        y: point.y,
                        components: [],
                        wires: [],
                        type: 'junction',
                        isGround: false
                    });
                }
                
                const node = physicalNodes.get(nodeKey);
                node.components.push({
                    componentId: component.id,
                    component: component,
                    terminal: terminalIndex,
                    terminalName: point.terminal || `T${terminalIndex}`
                });

                // Marcar como ground si el componente es ground
                if (component.type === 'ground') {
                    node.isGround = true;
                    node.type = 'ground';
                }
            });
        });

        // Procesar conexiones de cables
        circuit.wires.forEach(wire => {
            // Puntos de inicio y fin
            [wire.start, wire.end].forEach(point => {
                const nodeKey = this.generateNodeKey(point.x, point.y);
                
                if (!physicalNodes.has(nodeKey)) {
                    physicalNodes.set(nodeKey, {
                        id: `node_${nodeIdCounter++}`,
                        x: point.x,
                        y: point.y,
                        components: [],
                        wires: [],
                        type: 'wire_terminal',
                        isGround: false
                    });
                }
                
                const node = physicalNodes.get(nodeKey);
                if (!node.wires.includes(wire.id)) {
                    node.wires.push(wire.id);
                }
            });

            // Procesar uniones intermedias del cable
            if (wire.junctions && wire.junctions.length > 0) {
                wire.junctions.forEach(junction => {
                    const nodeKey = this.generateNodeKey(junction.x, junction.y);
                    
                    if (!physicalNodes.has(nodeKey)) {
                        physicalNodes.set(nodeKey, {
                            id: `node_${nodeIdCounter++}`,
                            x: junction.x,
                            y: junction.y,
                            components: [],
                            wires: [],
                            type: 'wire_junction',
                            isGround: false
                        });
                    }
                    
                    const node = physicalNodes.get(nodeKey);
                    if (!node.wires.includes(wire.id)) {
                        node.wires.push(wire.id);
                    }
                });
            }
        });

        console.log(`📍 Encontrados ${physicalNodes.size} nodos físicos`);
        return Array.from(physicalNodes.values());
    }

    /**
     * Genera clave única para un nodo basada en posición
     */
    generateNodeKey(x, y) {
        // Redondear a la tolerancia para agrupar nodos cercanos
        const roundedX = Math.round(x / this.tolerance) * this.tolerance;
        const roundedY = Math.round(y / this.tolerance) * this.tolerance;
        return `${roundedX},${roundedY}`;
    }

    /**
     * Crea nodos eléctricos unificando nodos físicos conectados
     */
    createElectricalNodes(physicalNodes, circuit) {
        console.log('⚡ Creando nodos eléctricos...');

        // Usar union-find para agrupar nodos conectados por cables
        const unionFind = new UnionFind(physicalNodes.length);
        const nodeIndexMap = new Map();
        
        // Mapear nodos a índices
        physicalNodes.forEach((node, index) => {
            nodeIndexMap.set(node.id, index);
        });

        // Conectar nodos que están unidos por cables de resistencia despreciable
        circuit.wires.forEach(wire => {
            if (wire.resistance < 1e-6) { // Cable ideal
                const startNode = this.findNodeAtPosition(physicalNodes, wire.start.x, wire.start.y);
                const endNode = this.findNodeAtPosition(physicalNodes, wire.end.x, wire.end.y);
                
                if (startNode && endNode) {
                    const startIndex = nodeIndexMap.get(startNode.id);
                    const endIndex = nodeIndexMap.get(endNode.id);
                    unionFind.union(startIndex, endIndex);
                }
            }
        });

        // Agrupar nodos por componente conectado
        const electricalNodeGroups = new Map();
        
        physicalNodes.forEach((node, index) => {
            const rootIndex = unionFind.find(index);
            
            if (!electricalNodeGroups.has(rootIndex)) {
                electricalNodeGroups.set(rootIndex, []);
            }
            electricalNodeGroups.get(rootIndex).push(node);
        });

        // Crear nodos eléctricos finales
        const electricalNodes = [];
        let electricalNodeId = 0;

        electricalNodeGroups.forEach((nodeGroup, rootIndex) => {
            // Calcular posición promedio del grupo
            const avgX = nodeGroup.reduce((sum, n) => sum + n.x, 0) / nodeGroup.length;
            const avgY = nodeGroup.reduce((sum, n) => sum + n.y, 0) / nodeGroup.length;

            // Combinar componentes y cables
            const allComponents = [];
            const allWires = new Set();
            let isGround = false;

            nodeGroup.forEach(physNode => {
                allComponents.push(...physNode.components);
                physNode.wires.forEach(wireId => allWires.add(wireId));
                if (physNode.isGround) isGround = true;
            });

            const electricalNode = {
                id: `enode_${electricalNodeId++}`,
                x: avgX,
                y: avgY,
                physicalNodes: nodeGroup.map(n => n.id),
                components: allComponents,
                wires: Array.from(allWires),
                connections: [], // Se llenará después
                isGround: isGround,
                voltage: 0, // Se calculará en el análisis
                type: this.classifyNodeType(allComponents, allWires.size)
            };

            electricalNodes.push(electricalNode);
        });

        // Establecer conexiones entre nodos eléctricos
        this.establishNodeConnections(electricalNodes, circuit);

        console.log(`⚡ Creados ${electricalNodes.length} nodos eléctricos`);
        return electricalNodes;
    }

    /**
     * Encuentra un nodo en una posición específica
     */
    findNodeAtPosition(nodes, x, y) {
        return nodes.find(node => 
            Math.abs(node.x - x) < this.tolerance && 
            Math.abs(node.y - y) < this.tolerance
        );
    }

    /**
     * Clasifica el tipo de nodo según sus conexiones
     */
    classifyNodeType(components, wireCount) {
        if (components.length === 0 && wireCount === 0) return 'isolated';
        if (components.some(c => c.component.type === 'ground')) return 'ground';
        if (components.length > 0 && wireCount === 0) return 'component_terminal';
        if (components.length === 0 && wireCount > 0) return 'wire_junction';
        if (components.length + wireCount === 2) return 'simple_connection';
        if (components.length + wireCount > 2) return 'junction';
        return 'unknown';
    }

    /**
     * Establece conexiones entre nodos eléctricos
     */
    establishNodeConnections(electricalNodes, circuit) {
        console.log('🔗 Estableciendo conexiones entre nodos...');

        // Para cada cable, conectar sus nodos extremos
        circuit.wires.forEach(wire => {
            const startNode = this.findElectricalNodeAtPosition(electricalNodes, wire.start.x, wire.start.y);
            const endNode = this.findElectricalNodeAtPosition(electricalNodes, wire.end.x, wire.end.y);

            if (startNode && endNode && startNode !== endNode) {
                // Agregar conexión bidireccional
                if (!startNode.connections.includes(endNode.id)) {
                    startNode.connections.push(endNode.id);
                }
                if (!endNode.connections.includes(startNode.id)) {
                    endNode.connections.push(startNode.id);
                }
            }
        });

        // Para cada componente, conectar sus terminales si están en nodos diferentes
        circuit.components.forEach(component => {
            if (component.type === 'ground') return; // Ground no cuenta como conexión

            const connectionPoints = component.getConnectionPoints();
            if (connectionPoints.length >= 2) {
                const node1 = this.findElectricalNodeAtPosition(electricalNodes, connectionPoints[0].x, connectionPoints[0].y);
                const node2 = this.findElectricalNodeAtPosition(electricalNodes, connectionPoints[1].x, connectionPoints[1].y);

                if (node1 && node2 && node1 !== node2) {
                    if (!node1.connections.includes(node2.id)) {
                        node1.connections.push(node2.id);
                    }
                    if (!node2.connections.includes(node1.id)) {
                        node2.connections.push(node1.id);
                    }
                }
            }
        });
    }

    /**
     * Encuentra el nodo eléctrico en una posición
     */
    findElectricalNodeAtPosition(electricalNodes, x, y) {
        return electricalNodes.find(node => 
            Math.abs(node.x - x) < this.tolerance && 
            Math.abs(node.y - y) < this.tolerance
        );
    }

    /**
     * Identifica las ramas del circuito
     */
    identifyBranches(circuit, electricalNodes) {
        console.log('🌿 Identificando ramas del circuito...');

        const branches = [];
        let branchId = 0;

        // Ramas de componentes
        circuit.components.forEach(component => {
            if (component.type === 'ground') return; // Ground no es una rama

            const connectionPoints = component.getConnectionPoints();
            if (connectionPoints.length >= 2) {
                const startNode = this.findElectricalNodeAtPosition(electricalNodes, connectionPoints[0].x, connectionPoints[0].y);
                const endNode = this.findElectricalNodeAtPosition(electricalNodes, connectionPoints[1].x, connectionPoints[1].y);

                if (startNode && endNode) {
                    branches.push({
                        id: `branch_${branchId++}`,
                        type: component.type,
                        componentId: component.id,
                        component: component,
                        startNodeId: startNode.id,
                        endNodeId: endNode.id,
                        startNode: startNode,
                        endNode: endNode,
                        current: 0,
                        voltage: 0,
                        impedance: this.getComponentImpedance(component)
                    });
                }
            }
        });

        // Ramas de cables con resistencia significativa
        circuit.wires.forEach(wire => {
            if (wire.resistance > 1e-6) { // Cable con resistencia
                const startNode = this.findElectricalNodeAtPosition(electricalNodes, wire.start.x, wire.start.y);
                const endNode = this.findElectricalNodeAtPosition(electricalNodes, wire.end.x, wire.end.y);

                if (startNode && endNode && startNode !== endNode) {
                    branches.push({
                        id: `branch_${branchId++}`,
                        type: 'wire',
                        wireId: wire.id,
                        wire: wire,
                        startNodeId: startNode.id,
                        endNodeId: endNode.id,
                        startNode: startNode,
                        endNode: endNode,
                        current: 0,
                        voltage: 0,
                        impedance: { real: wire.resistance, imaginary: 0 }
                    });
                }
            }
        });

        console.log(`🌿 Identificadas ${branches.length} ramas`);
        return branches;
    }

    /**
     * Obtiene la impedancia de un componente
     */
    getComponentImpedance(component, frequency = 0) {
        switch (component.type) {
            case 'resistor':
                return { real: component.value, imaginary: 0 };
            case 'capacitor':
                if (frequency === 0) return { real: Infinity, imaginary: 0 };
                const Xc = -1 / (2 * Math.PI * frequency * component.value);
                return { real: 0, imaginary: Xc };
            case 'inductor':
                const XL = 2 * Math.PI * frequency * component.value;
                return { real: 0, imaginary: XL };
            case 'voltage':
            case 'current':
                return { real: component.internalResistance || 0, imaginary: 0 };
            case 'diode':
                return { real: component.forwardResistance || 0.7, imaginary: 0 };
            default:
                return { real: 0, imaginary: 0 };
        }
    }

    /**
     * Analiza la topología del circuito
     */
    analyzeTopology(electricalNodes, branches, circuit) {
        console.log('🕸️ Analizando topología del circuito...');

        const topology = {
            description: 'general',
            isSeriesCircuit: false,
            isParallelCircuit: false,
            isLadderCircuit: false,
            isBridgeCircuit: false,
            hasLoops: false,
            loopCount: 0,
            meshes: [],
            criticalNodes: [],
            symmetries: []
        };

        // Detectar configuraciones especiales
        topology.isSeriesCircuit = this.detectSeriesCircuit(electricalNodes, branches);
        topology.isParallelCircuit = this.detectParallelCircuit(electricalNodes, branches);
        topology.isLadderCircuit = this.detectLadderCircuit(electricalNodes, branches);
        topology.isBridgeCircuit = this.detectBridgeCircuit(electricalNodes, branches);

        // Análisis de mallas
        topology.meshes = this.findMeshes(electricalNodes, branches);
        topology.loopCount = topology.meshes.length;
        topology.hasLoops = topology.loopCount > 0;

        // Identificar nodos críticos
        topology.criticalNodes = this.identifyCriticalNodes(electricalNodes);

        // Determinar descripción general
        if (topology.isSeriesCircuit) {
            topology.description = 'serie';
        } else if (topology.isParallelCircuit) {
            topology.description = 'paralelo';
        } else if (topology.isLadderCircuit) {
            topology.description = 'escalera';
        } else if (topology.isBridgeCircuit) {
            topology.description = 'puente';
        } else if (topology.loopCount === 1) {
            topology.description = 'malla simple';
        } else if (topology.loopCount > 1) {
            topology.description = 'multi-malla';
        }

        console.log(`🕸️ Topología identificada: ${topology.description}`);
        return topology;
    }

    /**
     * Detecta si el circuito es en serie
     */
    detectSeriesCircuit(nodes, branches) {
        // Un circuito es en serie si cada nodo (excepto terminales) tiene exactamente 2 conexiones
        const nonTerminalNodes = nodes.filter(node => !node.isGround && node.type !== 'component_terminal');
        
        if (nonTerminalNodes.length === 0) return false;

        return nonTerminalNodes.every(node => node.connections.length === 2);
    }

    /**
     * Detecta si el circuito es en paralelo
     */
    detectParallelCircuit(nodes, branches) {
        // Un circuito es en paralelo si todos los elementos están entre los mismos dos nodos
        if (branches.length <= 1) return false;

        const firstBranch = branches.find(b => b.type !== 'wire');
        if (!firstBranch) return false;

        const otherBranches = branches.filter(b => b.type !== 'wire' && b.id !== firstBranch.id);
        
        return otherBranches.every(branch => 
            (branch.startNodeId === firstBranch.startNodeId && branch.endNodeId === firstBranch.endNodeId) ||
            (branch.startNodeId === firstBranch.endNodeId && branch.endNodeId === firstBranch.startNodeId)
        );
    }

    /**
     * Detecta circuito en escalera
     */
    detectLadderCircuit(nodes, branches) {
        // Implementación simplificada: buscar patrón de nodos con 2-3 conexiones alternados
        const nodeConnectionCounts = nodes.map(node => node.connections.length);
        const uniqueCounts = [...new Set(nodeConnectionCounts)].sort();
        
        // Patrón típico de escalera: nodos con 2 y 3 conexiones
        return uniqueCounts.length === 2 && uniqueCounts.includes(2) && uniqueCounts.includes(3);
    }

    /**
     * Detecta circuito puente
     */
    detectBridgeCircuit(nodes, branches) {
        // Buscar configuración de puente: 5 nodos con patrón específico
        if (nodes.length !== 5) return false;

        // Contar nodos con diferentes números de conexiones
        const connectionCounts = nodes.reduce((acc, node) => {
            const count = node.connections.length;
            acc[count] = (acc[count] || 0) + 1;
            return acc;
        }, {});

        // Patrón típico de puente: 4 nodos con 3 conexiones, 1 nodo con 2 conexiones
        return connectionCounts[3] === 4 && connectionCounts[2] === 1;
    }

    /**
     * Encuentra mallas independientes en el circuito
     */
    findMeshes(nodes, branches) {
        const meshes = [];
        const visitedBranches = new Set();

        // Algoritmo simplificado de búsqueda de ciclos
        branches.forEach(startBranch => {
            if (visitedBranches.has(startBranch.id)) return;

            const mesh = this.findMeshFromBranch(startBranch, branches, visitedBranches);
            if (mesh.length > 2) {
                meshes.push({
                    id: `mesh_${meshes.length}`,
                    branches: mesh,
                    nodes: this.getNodesFromBranches(mesh)
                });
            }
        });

        return meshes;
    }

    /**
     * Encuentra una malla comenzando desde una rama específica
     */
    findMeshFromBranch(startBranch, allBranches, visitedBranches) {
        const mesh = [startBranch];
        let currentNode = startBranch.endNodeId;
        const startNode = startBranch.startNodeId;

        visitedBranches.add(startBranch.id);

        // Seguir el camino hasta volver al nodo inicial
        let iterations = 0;
        const maxIterations = allBranches.length + 1;

        while (currentNode !== startNode && iterations < maxIterations) {
            // Buscar siguiente rama no visitada
            const nextBranch = allBranches.find(branch => 
                !visitedBranches.has(branch.id) &&
                (branch.startNodeId === currentNode || branch.endNodeId === currentNode)
            );

            if (!nextBranch) break;

            mesh.push(nextBranch);
            visitedBranches.add(nextBranch.id);

            // Avanzar al siguiente nodo
            currentNode = nextBranch.startNodeId === currentNode ? 
                         nextBranch.endNodeId : 
                         nextBranch.startNodeId;

            iterations++;
        }

        return mesh;
    }

    /**
     * Obtiene nodos de una lista de ramas
     */
    getNodesFromBranches(branches) {
        const nodeIds = new Set();
        branches.forEach(branch => {
            nodeIds.add(branch.startNodeId);
            nodeIds.add(branch.endNodeId);
        });
        return Array.from(nodeIds);
    }

    /**
     * Identifica nodos críticos para el análisis
     */
    identifyCriticalNodes(nodes) {
        const criticalNodes = [];

        nodes.forEach(node => {
            let isCritical = false;
            let reason = '';

            // Nodo de referencia (ground)
            if (node.isGround) {
                isCritical = true;
                reason = 'referencia (ground)';
            }
            // Nodos de alta conectividad
            else if (node.connections.length > 3) {
                isCritical = true;
                reason = `alta conectividad (${node.connections.length} conexiones)`;
            }
            // Nodos con fuentes
            else if (node.components.some(c => ['voltage', 'current'].includes(c.component.type))) {
                isCritical = true;
                reason = 'conectado a fuente';
            }

            if (isCritical) {
                criticalNodes.push({
                    nodeId: node.id,
                    reason: reason,
                    connections: node.connections.length
                });
            }
        });

        return criticalNodes;
    }

    /**
     * Valida la estructura de nodos y ramas
     */
    validateNodeStructure(nodes, branches) {
        const errors = [];

        // Verificar que no hay nodos aislados (excepto ground)
        const isolatedNodes = nodes.filter(node => 
            node.connections.length === 0 && !node.isGround
        );
        
        if (isolatedNodes.length > 0) {
            errors.push(`Nodos aislados detectados: ${isolatedNodes.map(n => n.id).join(', ')}`);
        }

        // Verificar que hay al menos un nodo de referencia
        const groundNodes = nodes.filter(node => node.isGround);
        if (groundNodes.length === 0) {
            errors.push('No se encontró nodo de referencia (ground)');
        }

        // Verificar conectividad general
        if (!this.isGraphConnected(nodes)) {
            errors.push('El circuito tiene componentes desconectados');
        }

        // Verificar que las ramas conectan nodos válidos
        branches.forEach(branch => {
            const startNode = nodes.find(n => n.id === branch.startNodeId);
            const endNode = nodes.find(n => n.id === branch.endNodeId);
            
            if (!startNode || !endNode) {
                errors.push(`Rama ${branch.id} conecta nodos inválidos`);
            }
        });

        return {
            isValid: errors.length === 0,
            error: errors.join('; ')
        };
    }

    /**
     * Verifica si el grafo de nodos está conectado
     */
    isGraphConnected(nodes) {
        if (nodes.length === 0) return true;
        
        const visited = new Set();
        const queue = [nodes[0].id];
        visited.add(nodes[0].id);

        while (queue.length > 0) {
            const currentNodeId = queue.shift();
            const currentNode = nodes.find(n => n.id === currentNodeId);
            
            if (currentNode) {
                currentNode.connections.forEach(neighborId => {
                    if (!visited.has(neighborId)) {
                        visited.add(neighborId);
                        queue.push(neighborId);
                    }
                });
            }
        }

        return visited.size === nodes.length;
    }

    /**
     * Verifica conectividad básica del circuito
     */
    checkBasicConnectivity(circuit) {
        if (circuit.components.length === 0) {
            return { isConnected: false, reason: 'No hay componentes' };
        }

        if (circuit.wires.length === 0) {
            return { isConnected: false, reason: 'No hay conexiones' };
        }

        // Crear grafo de componentes conectados por cables
        const componentGraph = new Map();
        circuit.components.forEach(comp => {
            componentGraph.set(comp.id, new Set());
        });

        circuit.wires.forEach(wire => {
            if (wire.startComponent && wire.endComponent) {
                componentGraph.get(wire.startComponent).add(wire.endComponent);
                componentGraph.get(wire.endComponent).add(wire.startComponent);
            }
        });

        // BFS para verificar conectividad
        const visited = new Set();
        const queue = [circuit.components[0].id];
        visited.add(circuit.components[0].id);

        while (queue.length > 0) {
            const currentId = queue.shift();
            const neighbors = componentGraph.get(currentId) || new Set();
            
            neighbors.forEach(neighborId => {
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push(neighborId);
                }
            });
        }

        const isConnected = visited.size === circuit.components.length;
        
        return {
            isConnected,
            connectedComponents: visited.size,
            totalComponents: circuit.components.length,
            reason: isConnected ? 'Todos los componentes están conectados' : 
                   `${circuit.components.length - visited.size} componentes desconectados`
        };
    }
}

/**
 * Estructura de datos Union-Find para agrupar nodos conectados
 */
class UnionFind {
    constructor(size) {
        this.parent = Array.from({ length: size }, (_, i) => i);
        this.rank = new Array(size).fill(0);
    }

    find(x) {
        if (this.parent[x] !== x) {
            this.parent[x] = this.find(this.parent[x]); // Compresión de caminos
        }
        return this.parent[x];
    }

    union(x, y) {
        const rootX = this.find(x);
        const rootY = this.find(y);

        if (rootX !== rootY) {
            // Unión por rango
            if (this.rank[rootX] < this.rank[rootY]) {
                this.parent[rootX] = rootY;
            } else if (this.rank[rootX] > this.rank[rootY]) {
                this.parent[rootY] = rootX;
            } else {
                this.parent[rootY] = rootX;
                this.rank[rootX]++;
            }
        }
    }

    connected(x, y) {
        return this.find(x) === this.find(y);
    }
}