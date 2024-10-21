import { MaterialDefines } from "core/Materials/materialDefines";
import { MaterialPluginBase } from "core/Materials/materialPluginBase";
import type { InternalTexture } from "core/Materials/Textures/internalTexture";
import type { Material } from "core/Materials/material";
import { Constants } from "core/Engines/constants";
import type { StandardMaterial } from "core/Materials/standardMaterial";
import { PBRBaseMaterial } from "core/Materials/PBR/pbrBaseMaterial";
import type { UniformBuffer } from "core/Materials/uniformBuffer";
import { expandToProperty, serialize } from "core/Misc/decorators";
import { RegisterClass } from "core/Misc/typeStore";

import { ShaderLanguage } from "core/Materials/shaderLanguage";
/**
 * @internal
 */
class MaterialIBLShadowsRenderDefines extends MaterialDefines {
    public RENDER_WITH_IBL_SHADOWS = false;
    public RSMCREATE_PROJTEXTURE = false;
}

/**
 * Plugin used to render the global illumination contribution.
 */
export class IBLShadowsPluginMaterial extends MaterialPluginBase {
    /**
     * Defines the name of the plugin.
     */
    public static readonly Name = "IBLShadowsPluginMaterial";

    /**
     * The texture containing the global illumination contribution.
     */
    @serialize()
    public iblShadowsTexture: InternalTexture;

    /**
     * The opacity of the shadows.
     */
    @serialize()
    public shadowOpacity: number = 1.0;

    private _isEnabled = false;
    /**
     * Defines if the plugin is enabled in the material.
     */
    @serialize()
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public isEnabled = false;

    protected _markAllSubMeshesAsTexturesDirty(): void {
        this._enable(this._isEnabled);
        this._internalMarkAllSubMeshesAsTexturesDirty();
    }

    private _internalMarkAllSubMeshesAsTexturesDirty: () => void;

    /**
     * Gets a boolean indicating that the plugin is compatible with a give shader language.
     * @returns true if the plugin is compatible with the shader language
     */
    public override isCompatible(): boolean {
        return true;
    }

    constructor(material: Material | StandardMaterial | PBRBaseMaterial) {
        super(material, IBLShadowsPluginMaterial.Name, 310, new MaterialIBLShadowsRenderDefines());

        this._internalMarkAllSubMeshesAsTexturesDirty = material._dirtyCallbacks[Constants.MATERIAL_TextureDirtyFlag];
    }

    public override prepareDefines(defines: MaterialIBLShadowsRenderDefines) {
        defines.RENDER_WITH_IBL_SHADOWS = this._isEnabled;
    }

    public override getClassName() {
        return "IBLShadowsPluginMaterial";
    }

    public override getUniforms() {
        return {
            ubo: [
                { name: "renderTargetSize", size: 2, type: "vec2" },
                { name: "shadowOpacity", size: 1, type: "float" },
            ],
            fragment: `#ifdef RENDER_WITH_IBL_SHADOWS
                    uniform vec2 renderTargetSize;
                    uniform float shadowOpacity;
                #endif`,
        };
    }

    public override getSamplers(samplers: string[]) {
        samplers.push("iblShadowsTexture");
    }

    public override bindForSubMesh(uniformBuffer: UniformBuffer) {
        if (this._isEnabled) {
            uniformBuffer.bindTexture("iblShadowsTexture", this.iblShadowsTexture);
            uniformBuffer.updateFloat2("renderTargetSize", this._material.getScene().getEngine().getRenderWidth(), this._material.getScene().getEngine().getRenderHeight());
            uniformBuffer.updateFloat("shadowOpacity", this.shadowOpacity);
        }
    }

    public override getCustomCode(shaderType: string, shaderLanguage: ShaderLanguage) {
        let frag: { [name: string]: string };

        if (shaderLanguage === ShaderLanguage.WGSL) {
            frag = {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                CUSTOM_FRAGMENT_DEFINITIONS: `
                #ifdef RENDER_WITH_IBL_SHADOWS
                    var iblShadowsTextureSampler: sampler;
                    var iblShadowsTexture: texture_2d<f32>;

                    fn computeIndirectShadow() -> f32 {
                        var uv = fragmentInputs.position.xy / uniforms.renderTargetSize;
                        var shadowValue: f32 = toLinearSpace(textureSample(iblShadowsTexture, iblShadowsTextureSampler, uv).r);
                        return mix(shadowValue, 1.0, 1.0 - uniforms.shadowOpacity);
                    }
                #endif
            `,
            };

            if (this._material instanceof PBRBaseMaterial) {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                frag["CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION"] = `
                #ifdef RENDER_WITH_IBL_SHADOWS
                    #ifdef REFLECTION
                        var shadowValue: f32 = computeIndirectShadow();
                        finalIrradiance *= vec3f(shadowValue);
                        finalRadianceScaled *= vec3f(mix(1.0, shadowValue, roughness));
                    #endif
                #endif
            `;
            } else {
                frag["CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR"] = `
                #ifdef RENDER_WITH_IBL_SHADOWS
                    var shadowValue: f32 = computeIndirectShadow();
                    color *= toGammaSpace(vec4f(shadowValue, shadowValue, shadowValue, 1.0f));
                #endif
            `;
            }
        } else {
            frag = {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                CUSTOM_FRAGMENT_DEFINITIONS: `
                #ifdef RENDER_WITH_IBL_SHADOWS
                    uniform sampler2D iblShadowsTexture;

                    float computeIndirectShadow() {
                        vec2 uv = gl_FragCoord.xy / renderTargetSize;
                        float shadowValue = toLinearSpace(texture2D(iblShadowsTexture, uv).r);
                        return mix(shadowValue, 1.0, 1.0 - shadowOpacity);
                    }
                #endif
            `,
            };

            if (this._material instanceof PBRBaseMaterial) {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                frag["CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION"] = `
                #ifdef RENDER_WITH_IBL_SHADOWS
                    #ifdef REFLECTION
                        float shadowValue = computeIndirectShadow();
                        finalIrradiance *= shadowValue;
                        finalRadianceScaled *= mix(1.0, shadowValue, roughness);
                    #endif
                #endif
            `;
            } else {
                frag["CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR"] = `
                #ifdef RENDER_WITH_IBL_SHADOWS
                    color.rgb *= toGammaSpace(computeIndirectShadow());
                #endif
            `;
            }
        }

        return shaderType === "vertex" ? null : frag;
    }
}

RegisterClass(`BABYLON.IBLShadowsPluginMaterial`, IBLShadowsPluginMaterial);
