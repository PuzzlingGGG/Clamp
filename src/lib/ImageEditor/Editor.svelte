<script>
    import { onMount } from "svelte";
    import { playSound } from "../../resources/editor/sounds";

    import State from "../../resources/state";
    import BlobAndDataUrl from "../../resources/blobanddataurl";
    import Emitter from "../../resources/emitter";

    import proxyFetch from "../../resources/proxyFetch";

    import FileSaver from "file-saver";
    import fileDialog from "../../resources/fileDialog";

    import ImageLibrary from "./library.json";
    import '../../styles/library.css';

    let selectedCostume = "";
    let selectedCostumeType = "bitmap"; // can be bitmap, vector, or animated
    // target is an ID, not the character object
    export let target;
    let targetObj;

    /**
     * @type {HTMLCanvasElement}
    */
    let canvas;
    /**
     * @type {CanvasRenderingContext2D}
    */
    let ctx;
    const canvasSettings = {
        gridX: 4,
        gridY: 4
    };

    // svelte doesnt have a reload component thing yet
    // so just do this lol
    let _reloadComponent = 0;
    function reloadComponent() {
        _reloadComponent = 0;
        setTimeout(() => {
            _reloadComponent = 1;
        }, 1);
    }
    function reloadEditorComponents() {
        Emitter.emit("RELOAD_IMAGE_COMPONENTS");
    }
    function reloadCanvasComponent() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const costumeObject = State.getImageById(selectedCostume);
        if (!costumeObject) return;
        const image = new Image();
        image.src = costumeObject.image;
        image.onload = () => {
            canvas.width = image.width;
            canvas.height = image.height;
            // draw transparency BG
            // TODO: do that
            
            // draw image
            ctx.drawImage(image, 0, 0);
        };
    }

    onMount(() => {
        ctx = canvas.getContext('2d');
        reloadCanvasComponent();
        targetObj = State.getTargetById(target);
        // activates when we switch to any tab, but should be fine :idk_man:
        Emitter.on('EDITOR_TAB_SWITCHING', () => {
            targetObj = State.getTargetById(target);
        });
        Emitter.on('EDITOR_TAB_SWITCHED', (tab) => {
            targetObj = State.getTargetById(target);
            let selectedChanged = false;
            if (!selectedCostume && targetObj && tab === 'images') {
                selectedCostume = targetObj.startCostume;
                selectedChanged = true;
                updateCostumeType();
            }
            reloadComponent(); // we are ready now
            if (selectedChanged) {
                reloadCanvasComponent();
            }
        });
        Emitter.on('EDITING_TARGET_UPDATED', () => {
            _reloadComponent = 0;
            target = State.editingTarget; // we might be slightly behind on update
            targetObj = State.getTargetById(target);
            if (targetObj) {
                selectedCostume = targetObj.startCostume;
                updateCostumeType();
            }
            reloadComponent();
            reloadCanvasComponent();
        });
    });

    function updateCostumeType() {
        selectedCostumeType = "bitmap";
        if (!selectedCostume) return;
        const costumeObject = State.getImageById(selectedCostume);
        // .image is either a url or data url btw
        const url = costumeObject.image;
        if (!url) return;
        proxyFetch(url)
            .then(res => {
                if (!res.ok) return;
                const contentType = res.headers.get("Content-Type");
                switch (contentType) {
                    case 'image/apng':
                    case 'image/gif':
                        selectedCostumeType = 'animated';
                        break;
                    case 'image/svg+xml':
                        selectedCostumeType = 'vector';
                        break;
                }
            });
    }

    function selectCostume(id) {
        const character = State.getTargetById(target);
        if (!character) return;
        const idx = character.costumes.indexOf(id);
        if (idx === -1) return;

        playSound("tabswitch");
        selectedCostume = id;
        updateCostumeType();
        reloadComponent();
        reloadCanvasComponent();
    }

    async function newCostume() {
        playSound("confirm");
        const imageObject = await State.createImage(
            "Image",
            "https://clamp-coding.vercel.app/images/empty64.png"
        );
        State.addImageToCharacter(target, imageObject.id);
        selectedCostume = imageObject.id;
        updateCostumeType();
        reloadComponent();
        reloadEditorComponents();
        reloadCanvasComponent();
    }
    function importCostume() {
        playSound("tabswitch");
        // ask for file input
        fileDialog({ accept: "image/*" }).then((files) => {
            if (!files) return;
            const file = files[0];

            // create costume name
            const costumeNameIdx = file.name.lastIndexOf(".");
            const costumeName = file.name.substring(0, costumeNameIdx);

            // fr?!? 💀
            const fr = new FileReader();
            fr.onerror = () => {
                alert("Failed to import the image.");
            };
            fr.onload = async () => {
                // file readed lets make image
                const dataUrl = fr.result;
                const imageObject = await State.createImage(costumeName, dataUrl);

                // add image to character
                State.addImageToCharacter(target, imageObject.id);
                selectedCostume = imageObject.id;
                updateCostumeType();
                reloadComponent();
                reloadEditorComponents();
                reloadCanvasComponent();

                playSound("confirm");
            };
            // read file
            fr.readAsDataURL(file);
        });
    }

    function deleteCostume(costumeId, skipConfirm) {
        const character = State.getTargetById(target);
        if (!character) return;

        if (!skipConfirm) {
            if (!confirm("Do you want to delete this costume?")) return;
        }

        // remove costume from costume list
        const idx = character.costumes.indexOf(costumeId);
        if (idx === -1) return;
        character.costumes.splice(idx, 1);
        State.deleteImage(costumeId);
        let wasSelected = false;
        if (selectedCostume === costumeId) {
            selectedCostume = character.costumes[0];
            wasSelected = true;
        }
        updateCostumeType();

        if (character.startCostume === costumeId) {
            character.startCostume = character.costumes[0];
        }

        playSound("explode");

        reloadComponent();
        reloadEditorComponents();
        if (wasSelected) {
            reloadCanvasComponent();
        }

        // if (costumeId.startsWith("_hardcoded")) return;
    }

    function downloadBlob(blob, fileName) {
        FileSaver.saveAs(blob, fileName);
    }
    async function exportCostume() {
        playSound("tabswitch");

        if (!selectedCostume) return;
        const costumeObject = State.getImageById(selectedCostume);
        const costumeNameFiltered = `${costumeObject.name.replace(/[^0-9a-zA-Z-]+/gim, "_")}`;
        // .image is either a url or data url btw
        const url = costumeObject.image;
        if (!url) return;

        if (url.startsWith("data:")) {
            // data url, no need to fetch when we have the data
            const blob = BlobAndDataUrl.base64DataURLtoBlob(url);
            const fileType = await BlobAndDataUrl.fileTypeFromBlob(blob);
            const fileName = `${costumeNameFiltered}.${fileType}`;
            downloadBlob(blob, fileName);
            return;
        }
        // url, we need to fetch the image data
        try {
            const response = await proxyFetch(url);
            if (!response.ok) throw new Error(`Response status code ${response.status};`);
            const blob = await response.blob();
            const fileType = await BlobAndDataUrl.fileTypeFromBlob(blob);
            const fileName = `${costumeNameFiltered}.${fileType}`;
            downloadBlob(blob, fileName);
        } catch (err) {
            alert("Failed to download the image.");
            throw err;
        }
    }
    // image libraru
    let isImageLibraryOpen = false;
    function openCostumeLibrary() {
        playSound("tabswitch");
        isImageLibraryOpen = true;
    }
    async function importLibraryImage(image) {
        playSound("confirm");
        const imageObject = await State.createImage(image.name, image.image);
        State.addImageToCharacter(target, imageObject.id);
        selectedCostume = imageObject.id;
        updateCostumeType();
        reloadComponent();
        reloadEditorComponents();
        reloadCanvasComponent();
    }
</script>

{#if isImageLibraryOpen}
    <div class="library">
        <div class="library-title">
            <h1>Images</h1>
        </div>
        <div class="library-contents-w">
            {#each ImageLibrary as image}
                <button
                    class="library-item"
                    on:click={() => importLibraryImage(image)}
                >
                    <img
                        src={image.image}
                        alt={image.name}
                        title={image.name}
                        class="library-image"
                    />
                    <p style="margin-block:0">{image.name}</p>
                </button>
            {/each}
        </div>
        <div class="library-footer">
            <button
                class="library-exit"
                on:click={() => {
                    isImageLibraryOpen = false;
                    playSound("tabswitch");
                }}
            >
                Cancel
            </button>
        </div>
    </div>
    <div class="backing" />
{/if}
<div class="main">
    {#if _reloadComponent}
        <p style="margin-left:8px">• {targetObj.name}</p>
        <div class="image-list">
            <!-- New Image Button -->
            <div class="costume-preview-div">
                <button class="box" on:click={() => newCostume()}>
                    <img
                        alt={"New Image"}
                        title={"New Image"}
                        class="image-preview"
                        style="width:32px;height:32px;image-rendering: pixelated;"
                        src={"/images/gui-icons/add-icon.png"}
                    />
                </button>
                <p class="costume-name">New</p>
            </div>
            <!-- Import Image Button -->
            <div class="costume-preview-div">
                <button class="box" on:click={() => importCostume()}>
                    <img
                        alt={"Import an Image"}
                        title={"Import an Image"}
                        class="image-preview"
                        style="width:32px;height:32px;image-rendering: pixelated;"
                        src={"/images/gui-icons/page-white-put-icon.png"}
                    />
                </button>
                <p class="costume-name">Import</p>
            </div>
            <!-- Choose Library Image Button -->
            <div class="costume-preview-div">
                <button class="box" on:click={() => openCostumeLibrary()}>
                    <img
                        alt={"Find an Image from a Library"}
                        title={"Find an Image from a Library"}
                        class="image-preview"
                        style="width:32px;height:32px;image-rendering: pixelated;"
                        src={"/images/gui-icons/folder-magnify-icon.png"}
                    />
                </button>
                <p class="costume-name">Find</p>
            </div>
            {#each targetObj.costumes as costumeId}
                <div class="costume-preview-div">
                    <button
                        class="box"
                        data-selected={selectedCostume === costumeId}
                        on:click={() => selectCostume(costumeId)}
                    >
                        <button
                            class="delete-image-button"
                            style={targetObj.costumes
                                .length <= 1
                                ? "cursor: not-allowed"
                                : ""}
                            on:click={(event) =>
                                targetObj.costumes.length <= 1
                                    ? null
                                    : deleteCostume(costumeId, event.shiftKey)}
                        >
                            <!-- svelte-ignore a11y-img-redundant-alt -->
                            <img
                                src="/images/gui-icons/cancel-icon.png"
                                alt="Delete this Image"
                                title="Delete this Image"
                                style={targetObj.costumes
                                    .length <= 1
                                    ? "filter: grayscale(1)"
                                    : ""}
                            />
                        </button>
                        <img
                            alt={State.getImageById(costumeId).name}
                            title={State.getImageById(costumeId).name}
                            class="image-preview"
                            src={State.getImageById(costumeId).image}
                        />
                    </button>
                    <p class="costume-name">
                        {State.getImageById(costumeId).name}
                    </p>
                </div>
            {/each}
        </div>
        {#if selectedCostumeType === 'vector'}
            <!-- TODO: Add support for Vector-based images. -->
            <p><i>This image is vector-based. This format is not yet supported, and will become a bitmap when edited.</i></p>
        {:else if selectedCostumeType === 'animated'}
            <p><i>This image may be animated. Animated images will become static images when edited.</i></p>
        {:else}
            <p style="opacity: 0; user-select: none;"><i>googaga</i></p>
        {/if}
    {/if}

    <!-- we cant refresh this canvas each time -->
    <div class="canvas-wrapper">
        <canvas
            bind:this={canvas}
            style={_reloadComponent ? '' : 'display:none'}
        />
    </div>

    {#if _reloadComponent}
        <div>
            <button class="export-button" on:click={exportCostume}>
                Download Image
            </button>
        </div>
    {/if}
</div>

<style>
    .main {
        position: absolute;
        left: 0px;
        top: 0px;
        width: 100%;
        height: 100%;
    }
    canvas {
        background: white;
    }
    .canvas-wrapper {
        width: 100%;
        height: calc(100% - (40px + 216px + 32px));
        overflow: auto;
    }
    
    .library-contents-w {
        width: 100%;
        height: calc(90% - 88px);

        overflow: auto;

        display: flex;
        flex-wrap: wrap;
        flex-direction: row;
        align-items: baseline;
        align-content: flex-start;
    }

    .image-list {
        width: 100%;
        height: 128px;
        overflow-x: auto;
        display: flex;
        flex-direction: row;
        align-items: center;
    }
    .costume-preview-div {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 128px;
    }

    .box {
        position: relative;
        width: 5.5em;
        height: 5.5em;
        padding: 8px;
        border: 4px solid rgba(255, 255, 255, 0.25);
        border-radius: 16px;
        background: transparent;
        margin: 8px;
        cursor: pointer;
    }
    .box:focus,
    .box:hover {
        background: rgba(255, 255, 255, 0.1);
    }
    .box:active {
        background: rgba(255, 255, 255, 0.25);
    }
    .box[data-selected="true"] {
        border: 4px solid #b200fe;
    }

    .image-preview {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }
    .costume-name {
        width: 60%;
        height: 18px;
        color: white;
        text-align: center;
        margin-block: 0;
        text-wrap: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
    }

    .export-button {
        margin: 8px;
        padding: 4px 8px;
        background: rgb(163,0,232);
        background: linear-gradient(0deg, rgba(163,0,232,1) 49%, rgba(191,41,255,1) 50%);
        color: white;
        border: 1px solid white;
        border-radius: 8px;
        font-size: 20px;
        cursor: pointer;
    }
    .export-button:active {
        background: rgb(140,0,201);
        background: linear-gradient(0deg, rgba(140,0,201,1) 48%, rgb(158, 34, 211) 49%);
    }

    .delete-image-button {
        position: absolute;
        top: -12px;
        right: -12px;
        width: 24px;
        height: 24px;

        background: transparent;
        border: 0;

        cursor: pointer;
    }
    .delete-image-button > img {
        position: absolute;
        top: 0px;
        left: 0px;
        width: 24px;
        height: 24px;
    }
</style>
