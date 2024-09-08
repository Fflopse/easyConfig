import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, GripVertical, Plus, ChevronDown, ChevronUp, Copy, Box, Square, Maximize2, Minimize2, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const LocationVisualization = ({ locations, is3D }) => {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const [hoveredPoint, setHoveredPoint] = useState(null);

    useEffect(() => {
        if (!mountRef.current) return;

        const width = mountRef.current.clientWidth;
        const height = 400;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ alpha: true });
        rendererRef.current = renderer;

        renderer.setSize(width, height);
        mountRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);

        const points = locations.map((loc, index) => ({
            position: new THREE.Vector3(loc.x, is3D ? loc.y : 0, loc.z),
            index: index + 1
        }));

        const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => p.position));
        const material = new THREE.PointsMaterial({ color: 0xffffff, size: 5 });
        const pointCloud = new THREE.Points(geometry, material);
        scene.add(pointCloud);

        // Center the camera on the points
        const box = new THREE.Box3().setFromPoints(points.map(p => p.position));
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        camera.position.set(center.x, center.y, center.z + cameraZ);
        camera.lookAt(center);
        controls.target.set(center.x, center.y, center.z);
        controls.update();

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const onMouseMove = (event) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(pointCloud);

            if (intersects.length > 0) {
                const index = intersects[0].index;
                setHoveredPoint(points[index].index);
            } else {
                setHoveredPoint(null);
            }
        };

        renderer.domElement.addEventListener('mousemove', onMouseMove);

        const animate = () => {
            if (!sceneRef.current || !rendererRef.current) return;
            requestAnimationFrame(animate);
            controls.update();
            rendererRef.current.render(sceneRef.current, camera);
        };

        animate();

        return () => {
            renderer.domElement.removeEventListener('mousemove', onMouseMove);
            if (mountRef.current && renderer.domElement) {
                mountRef.current.removeChild(renderer.domElement);
            }
            if (sceneRef.current) {
                // Dispose of scene objects
                sceneRef.current.traverse((object) => {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) object.material.dispose();
                });
            }
            if (rendererRef.current) {
                rendererRef.current.dispose();
            }
        };
    }, [locations, is3D]);

    return (
        <div className="relative">
            <div ref={mountRef} style={{ width: '100%', height: '400px' }}></div>
            {hoveredPoint && (
                <div className="absolute top-2 left-2 bg-gray-800 text-white p-2 rounded">
                    Point #{hoveredPoint}
                </div>
            )}
        </div>
    );
};

const JsonEditor = () => {
    const [json, setJson] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [fileName, setFileName] = useState('');
    const [bulkMove, setBulkMove] = useState({ x: 0, y: 0, z: 0 });
    const [showMoveAll, setShowMoveAll] = useState(false);
    const [showJsonDisplay, setShowJsonDisplay] = useState(false);
    const [is3DView, setIs3DView] = useState(true);
    const [showVisualization, setShowVisualization] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const [jsonInput, setJsonInput] = useState('');
    const [fetchError, setFetchError] = useState(null);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsedJson = JSON.parse(e.target.result);
                setJson(parsedJson);
            } catch (error) {
                console.error('Error parsing JSON:', error);
            }
        };
        reader.readAsText(file);
    };

    const handleUrlFetch = async () => {
        try {
            setFetchError(null);
            let url = urlInput.trim();

            if (url.startsWith('https://paste.cytooxien.de/') && !url.includes('/raw/')) {
                const pasteId = url.split('/').pop();
                url = `https://paste.cytooxien.de/raw/${pasteId}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setJson(data);
            setFileName(url.split('/').pop() || 'Fetched JSON');
        } catch (error) {
            console.error('Error fetching JSON:', error);
            setFetchError('Could not fetch the JSON from the URL provided. Maybe CORS is not enabled for the source? (paste.cytooxien.de not suppported)');
        }
    };

    const handleDownload = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(json, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "map_data.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleJsonPaste = () => {
        try {
            const parsedJson = JSON.parse(jsonInput);
            setJson(parsedJson);
            setFileName('Pasted JSON');
            setFetchError(null);
        } catch (error) {
            console.error('Error parsing pasted JSON:', error);
            setFetchError('Error parsing pasted JSON. Please check the format. Paste must not include line numbers. Please paste from paste.cytooxien.de/RAW/...');
        }
    };

    const handleMapParamChange = (param, value) => {
        setJson(prevJson => ({
            ...prevJson,
            [param]: value
        }));
    };

    const handleLocationChange = (category, index, param, value) => {
        setJson(prevJson => ({
            ...prevJson,
            locations: {
                ...prevJson.locations,
                [category]: prevJson.locations[category].map((item, i) =>
                    i === index ? {
                        ...item,
                        [param]: ['x', 'y', 'z', 'yaw', 'pitch'].includes(param) ? parseFloat(value) || 0 : value
                    } : item
                )
            }
        }));
    };

    const addLocation = (category, index = null) => {
        setJson(prevJson => {
            const newLocation = {x: 0, y: 0, z: 0, yaw: 0, pitch: 0, customOptions: {}};
            const updatedLocations = [...prevJson.locations[category]];
            if (index !== null) {
                updatedLocations.splice(index, 0, newLocation);
            } else {
                updatedLocations.push(newLocation);
            }
            return {
                ...prevJson,
                locations: {
                    ...prevJson.locations,
                    [category]: updatedLocations
                }
            };
        });
    };

    const removeLocation = (category, index) => {
        setJson(prevJson => ({
            ...prevJson,
            locations: {
                ...prevJson.locations,
                [category]: prevJson.locations[category].filter((_, i) => i !== index)
            }
        }));
    };

    const onDragEnd = (result) => {
        if (!result.destination) {
            return;
        }

        const items = Array.from(json.locations[selectedCategory]);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setJson(prevJson => ({
            ...prevJson,
            locations: {
                ...prevJson.locations,
                [selectedCategory]: items
            }
        }));
    };

    const handleBulkMoveChange = (axis, value) => {
        setBulkMove(prev => ({...prev, [axis]: parseFloat(value) || 0}));
    };

    const applyBulkMove = () => {
        setJson(prevJson => ({
            ...prevJson,
            locations: {
                ...prevJson.locations,
                [selectedCategory]: prevJson.locations[selectedCategory].map(location => ({
                    ...location,
                    x: parseFloat(location.x) + bulkMove.x,
                    y: parseFloat(location.y) + bulkMove.y,
                    z: parseFloat(location.z) + bulkMove.z
                }))
            }
        }));
        setBulkMove({x: 0, y: 0, z: 0});
    };

    const copyJsonToClipboard = () => {
        navigator.clipboard.writeText(JSON.stringify(json, null, 2))
            .then(() => alert('JSON copied to clipboard!'))
            .catch(err => console.error('Failed to copy JSON: ', err));
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 text-gray-100 p-4">
            <h1 className="text-4xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-gray-300 to-gray-500">
                easy config
            </h1>

            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col">
                    <label className="text-lg font-semibold mb-2">from JSON / text file:</label>
                    <div className="flex-grow flex flex-col">
                        <div className="relative flex-grow flex items-center">
                            <input
                                type="file"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="w-full bg-gray-700 text-gray-300 px-3 py-2 rounded border border-gray-600 flex items-center justify-between">
                                <span className="truncate">
                                    {fileName || "Choose file"}
                                </span>
                                <Upload size={20} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col">
                    <label className="text-lg font-semibold mb-2">fetch from URL:</label>
                    <div className="flex-grow flex flex-col">
                        <input
                            type="text"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="Enter URL"
                            className="flex-grow bg-gray-700 text-gray-100 px-3 py-2 rounded-t border border-gray-600"
                        />
                        <button
                            onClick={handleUrlFetch}
                            className="bg-blue-600 text-white px-4 py-2 rounded-b hover:bg-blue-700"
                        >
                            Fetch
                        </button>
                    </div>
                </div>

                <div className="flex flex-col">
                    <label className="text-lg font-semibold mb-2">paste JSON:</label>
                    <div className="flex-grow flex flex-col">
                        <textarea
                            value={jsonInput}
                            onChange={(e) => setJsonInput(e.target.value)}
                            placeholder="Paste your JSON here"
                            className="flex-grow bg-gray-700 text-gray-100 px-3 py-2 rounded-t border border-gray-600 resize-none"
                        />
                        <button
                            onClick={handleJsonPaste}
                            className="bg-blue-600 text-white px-4 py-2 rounded-b hover:bg-blue-700"
                        >
                            Parse JSON
                        </button>
                    </div>
                </div>
            </div>

            {fetchError && (
                <Alert variant="destructive" className="mt-4 mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{fetchError}</AlertDescription>
                </Alert>
            )}

            {fileName && (
                <p className="mt-2 mb-4 text-sm text-gray-400">
                    Loaded: {fileName}
                </p>
            )}

            {json && (
                <div className="space-y-6">
                    <div className="bg-gray-800 p-4 rounded-lg">
                        <h2 className="text-xl font-semibold mb-3">Map Parameters</h2>
                        <div className="flex flex-wrap gap-4">
                            <div className="flex-grow">
                                <label className="block mb-1">Name:</label>
                                <input
                                    type="text"
                                    value={json.name}
                                    onChange={(e) => handleMapParamChange('name', e.target.value)}
                                    className="w-full bg-gray-700 text-gray-100 px-3 py-2 rounded border border-gray-600"
                                />
                            </div>
                            <div className="flex-grow">
                                <label className="block mb-1">Death Height:</label>
                                <input
                                    type="number"
                                    value={json.deathHeight}
                                    onChange={(e) => handleMapParamChange('deathHeight', parseFloat(e.target.value))}
                                    className="w-full bg-gray-700 text-gray-100 px-3 py-2 rounded border border-gray-600"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 p-4 rounded-lg">
                        <h2 className="text-xl font-semibold mb-3">Locations</h2>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full bg-gray-700 text-gray-100 px-3 py-2 rounded border border-gray-600 mb-4"
                        >
                            <option value="">Select a category</option>
                            {Object.keys(json.locations).map((category) => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>

                        {selectedCategory && (
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold">{selectedCategory}</h3>
                                    <div className="flex space-x-4">
                                        <button
                                            onClick={() => setShowVisualization(!showVisualization)}
                                            className="bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 flex items-center"
                                        >
                                            {showVisualization ? <Minimize2 size={16} className="mr-2"/> :
                                                <Maximize2 size={16} className="mr-2"/>}
                                            {showVisualization ? 'Hide' : 'Show'} Visualization
                                        </button>
                                        <button
                                            onClick={() => setShowMoveAll(!showMoveAll)}
                                            className="text-gray-300 hover:text-white"
                                        >
                                            Move All {showMoveAll ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                        </button>
                                    </div>
                                </div>

                                {showVisualization && (
                                    <div className="mb-4">
                                        <div className="flex justify-end mb-2">
                                            <button
                                                onClick={() => setIs3DView(!is3DView)}
                                                className="bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 flex items-center"
                                            >
                                                {is3DView ? <Box size={16} className="mr-2"/> :
                                                    <Square size={16} className="mr-2"/>}
                                                {is3DView ? '3D View' : '2D View'}
                                            </button>
                                        </div>
                                        <LocationVisualization
                                            locations={json.locations[selectedCategory]}
                                            is3D={is3DView}
                                        />
                                    </div>
                                )}

                                {showMoveAll && (
                                    <div className="bg-gray-700 p-4 rounded mb-4">
                                        <div className="flex flex-wrap gap-4 mb-2">
                                            {['x', 'y', 'z'].map(axis => (
                                                <div key={axis} className="flex items-center">
                                                    <label className="mr-2">{axis.toUpperCase()}:</label>
                                                    <input
                                                        type="number"
                                                        value={bulkMove[axis]}
                                                        onChange={(e) => handleBulkMoveChange(axis, e.target.value)}
                                                        className="bg-gray-600 text-gray-100 px-2 py-1 rounded border border-gray-500 w-20"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            onClick={applyBulkMove}
                                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                        >
                                            Apply Move All
                                        </button>
                                    </div>
                                )}

                                <DragDropContext onDragEnd={onDragEnd}>
                                    <Droppable droppableId={selectedCategory}>
                                        {(provided) => (
                                            <div {...provided.droppableProps} ref={provided.innerRef}
                                                 className="space-y-2">
                                                <button
                                                    onClick={() => addLocation(selectedCategory, 0)}
                                                    className="w-full bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 flex items-center justify-center"
                                                >
                                                    <Plus size={16} className="mr-2"/>
                                                    Insert at beginning
                                                </button>
                                                {json.locations[selectedCategory].map((location, index) => (
                                                    <Draggable key={`${selectedCategory}-${index}`}
                                                               draggableId={`${selectedCategory}-${index}`}
                                                               index={index}>
                                                        {(provided) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className="bg-gray-700 p-2 rounded border border-gray-600 flex items-center"
                                                            >
                                                                <div {...provided.dragHandleProps} className="mr-2">
                                                                    <GripVertical className="text-gray-400" size={16}/>
                                                                </div>
                                                                <span className="mr-2 text-gray-400">#{index + 1}</span>
                                                                <div
                                                                    className="flex-grow flex flex-wrap gap-2 items-center">
                                                                    {Object.entries(location).map(([param, value]) => (
                                                                        param !== 'customOptions' && (
                                                                            <div key={param}
                                                                                 className="flex items-center space-x-1">
                                                                                <label
                                                                                    className="text-xs">{param}:</label>
                                                                                <input
                                                                                    type={['x', 'y', 'z', 'yaw', 'pitch'].includes(param) ? 'number' : 'text'}
                                                                                    value={value}
                                                                                    onChange={(e) => handleLocationChange(selectedCategory, index, param, e.target.value)}
                                                                                    className="bg-gray-600 text-gray-100 px-1 py-0.5 rounded border border-gray-500 text-xs w-20"
                                                                                />
                                                                            </div>
                                                                        )
                                                                    ))}
                                                                </div>
                                                                <button
                                                                    onClick={() => removeLocation(selectedCategory, index)}
                                                                    className="ml-2 bg-gray-600 text-gray-300 px-2 py-1 rounded text-xs hover:bg-gray-500"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                                <button
                                                    onClick={() => addLocation(selectedCategory)}
                                                    className="w-full bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 flex items-center justify-center"
                                                >
                                                    <Plus size={16} className="mr-2"/>
                                                    Add at end
                                                </button>
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-center space-x-4">
                        <button
                            onClick={handleDownload}
                            className="bg-gray-700 text-gray-100 px-4 py-2 rounded text-lg font-semibold hover:bg-gray-600 transition-colors duration-300 flex items-center justify-center"
                        >
                            Download JSON
                        </button>

                        <button
                            onClick={() => setShowJsonDisplay(!showJsonDisplay)}
                            className="bg-gray-700 text-gray-100 px-4 py-2 rounded text-lg font-semibold hover:bg-gray-600 transition-colors duration-300 flex items-center justify-center"
                        >
                            {showJsonDisplay ? 'Hide' : 'Show'} JSON
                        </button>
                    </div>

                    {showJsonDisplay && (
                        <div className="relative mt-4">
            <pre className="bg-gray-800 p-4 rounded-lg text-left overflow-auto max-h-96 text-sm">
              {JSON.stringify(json, null, 2)}
            </pre>
                            <button
                                onClick={copyJsonToClipboard}
                                className="absolute top-2 right-2 bg-gray-700 text-gray-300 p-2 rounded hover:bg-gray-600"
                                title="Copy to clipboard"
                            >
                                <Copy size={16}/>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {!json && (
                <Alert variant="default" className="mt-6 bg-gray-800 border-gray-700 text-gray-300">
                    <AlertCircle className="h-4 w-4"/>
                    <AlertTitle>No JSON Loaded</AlertTitle>
                    <AlertDescription>
                        Please provide a JSON to start editing.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
};

export default JsonEditor;