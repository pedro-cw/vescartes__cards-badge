class SizeDrawer extends HTMLElement {
  constructor() {
    super(),
      (this.handleOpenButtonClick = this.handleOpenButtonClick.bind(this)),
      (this.handleKeyUp = (evt) => evt.code === "Escape" && this.close()),
      (this.handleTableHover = this.handleTableHover.bind(this)),
      (this.handleTableLeave = this.handleTableLeave.bind(this)),
      (this.handleTableClick = this.handleTableClick.bind(this)),
      (this.initSelectedSize = this.initSelectedSize.bind(this));
  }
  connectedCallback() {
    this.addEventListener("keyup", this.handleKeyUp),
      this.querySelector("#SizeDrawer-Overlay")?.addEventListener(
        "click",
        this.close.bind(this)
      ),
      (this.openButtons = document.querySelectorAll("#open-size-drawer")),
      (this.actionButton = this.querySelector(".size-guide--actions > button")),
      (this.BISOpen = this.querySelector(
        '.size-guide--actions > modal-opener[data-modal="#Drawer-BackInStock"]'
      )),
      this.BISOpen &&
        this.BISOpen.addEventListener("click", this.close.bind(this)),
      this.actionButton &&
        this.actionButton.addEventListener("click", async () => {
          const isAppUserAgent = navigator.userAgent.includes("source:stikky"),
            variantId = this.querySelector("td.selected button")
              ? this.querySelector("td.selected button").getAttribute("variant")
              : this.querySelector("td.selected")
                  .parentElement.querySelector("button")
                  .getAttribute("variant");
          console.log("DEBUG: variantId ", variantId),
            isAppUserAgent && variantId
              ? (
                  await StikkySDK.actions.addToCart({ variantId, quantity: 1 })
                ).fold(
                  (error) =>
                    console.error(
                      `addToCart Failed: ${error.message} (Type: ${error.type}, Name: ${error.name})`
                    ),
                  (cart) =>
                    console.log("addToCart Success! Updated cart:", cart)
                )
              : (this.close(),
                document.querySelector(".product-form__submit")?.click());
        }),
      this.openButtons.length > 0 &&
        this.openButtons.forEach((button) =>
          button.addEventListener("click", this.handleOpenButtonClick)
        ),
      this.initTableHover(),
      this.initTableClick(),
      this.initSizeTabs();
  }
  disconnectedCallback() {
    this.removeEventListener("keyup", this.handleKeyUp),
      this.querySelector("#SizeDrawer-Overlay")?.removeEventListener(
        "click",
        this.close.bind(this)
      ),
      this.BISOpen &&
        this.BISOpen.removeEventListener("click", this.close.bind(this)),
      this.openButtons.length > 0 &&
        this.openButtons.forEach((button) =>
          button.removeEventListener("click", this.handleOpenButtonClick)
        ),
      this.cleanupTableHover(),
      this.cleanupTableClick();
  }
  handleOpenButtonClick(event) {
    navigator.userAgent.includes("source:stikky") ||
      (event.preventDefault(), this.open());
  }
  open() {
    setTimeout(() => {
      this.classList.add("animate", "active"), this.updateTableUnits("cm");
      const cmRadio = this.querySelector('input[name="size-tabs"][value="cm"]');
      cmRadio && (cmRadio.checked = !0), this.initSelectedSize();
    }),
      document.body.classList.add("overflow-hidden");
  }
  close() {
    this.classList.remove("active"),
      document.body.classList.remove("overflow-hidden");
  }
  initSelectedSize() {
    const selectedSize = document.querySelector(
      'variant-selects input[name="Gr\xF6\xDFe"]:checked'
    );
    selectedSize &&
      (console.log(
        "DEBUG: clcked btn ",
        this.querySelector(`td[data-size="${selectedSize.value}"] + td`)
      ),
      this.querySelector(
        `td[data-size="${selectedSize.value}"] + td`
      ).dispatchEvent(new Event("click", { bubbles: !0 })));
  }
  initTableHover() {
    (this.sizeGuideTable = this.querySelector(".size-guide--table table")),
      this.sizeGuideTable &&
        ((this.tableCells = this.sizeGuideTable.querySelectorAll("th, td")),
        this.tableCells.forEach((cell) => {
          cell.addEventListener("mouseenter", this.handleTableHover),
            cell.addEventListener("mouseleave", this.handleTableLeave);
        }));
  }
  cleanupTableHover() {
    this.tableCells &&
      this.tableCells.forEach((cell) => {
        cell.removeEventListener("mouseenter", this.handleTableHover),
          cell.removeEventListener("mouseleave", this.handleTableLeave);
      });
  }
  handleTableHover(e) {
    const cell = e.currentTarget,
      table = this.sizeGuideTable;
    if (!table) return;
    const row = cell.parentElement,
      rowIndex = Array.from(row.parentElement.children).indexOf(row),
      cellIndex = Array.from(cell.parentElement.children).indexOf(cell);
    cell.tagName !== "TH" &&
      Array.from(row.children).forEach((c) => c.classList.add("highlight")),
      cell.getAttribute("data-size") ||
        Array.from(table.rows).forEach((r) => {
          r.children[cellIndex] &&
            r.children[cellIndex].classList.add("highlight");
        });
  }
  handleTableLeave(e) {
    this.sizeGuideTable &&
      this.sizeGuideTable
        .querySelectorAll(".highlight")
        .forEach((cell) => cell.classList.remove("highlight"));
  }
  initTableClick() {
    this.sizeGuideTable &&
      ((this.tableTds = this.sizeGuideTable.querySelectorAll("td")),
      this.tableTds.forEach((td) => {
        td.addEventListener("click", this.handleTableClick);
      }));
  }
  cleanupTableClick() {
    this.tableTds &&
      this.tableTds.forEach((td) => {
        td.removeEventListener("click", this.handleTableClick);
      });
  }
  handleTableClick(e) {
    this.tableTds.forEach((td) => td.classList.remove("selected")),
      e.currentTarget.classList.add("selected"),
      this.toggleActionButton(),
      this.selectVariantInputForSelectedRow(e.currentTarget);
  }
  selectVariantInputForSelectedRow(selectedTd) {
    const row = selectedTd.closest("tr");
    if (!row) return;
    const sizeLabel = row.querySelector("td")?.textContent?.trim();
    if (!sizeLabel) return;
    const variantSelects = document.querySelector("variant-selects");
    if (!variantSelects) return;
    const sizeInput = variantSelects.querySelector(
      "input[name='Gr\xF6\xDFe'][value='" + CSS.escape(sizeLabel) + "']"
    );
    console.log("DEBUG: sizeInput ", sizeInput, sizeInput.dataset.disabled),
      sizeInput &&
        ((sizeInput.checked = !0),
        sizeInput.dispatchEvent(new Event("change", { bubbles: !0 })),
        this.actionButton &&
          this.actionButton.classList.contains("hidden") &&
          this.actionButton.classList.remove("hidden"),
        this.BISOpen &&
          !this.BISOpen.classList.contains("hidden") &&
          this.BISOpen.classList.add("hidden")),
      sizeInput &&
        sizeInput.dataset.disabled &&
        (this.actionButton &&
          !this.actionButton.classList.contains("hidden") &&
          this.actionButton.classList.add("hidden"),
        this.BISOpen &&
          this.BISOpen.classList.contains("hidden") &&
          this.BISOpen.classList.remove("hidden"));
  }
  toggleActionButton() {
    const hasSelected = Array.from(this.tableTds).some((td) =>
      td.classList.contains("selected")
    );
    this.actionButton && (this.actionButton.disabled = !hasSelected);
  }
  initSizeTabs() {
    (this.sizeTabInputs = this.querySelectorAll('input[name="size-tabs"]')),
      this.sizeTabInputs.forEach((input) => {
        input.addEventListener("change", this.handleSizeTabChange.bind(this));
      }),
      this.updateTableUnits("cm");
  }
  handleSizeTabChange(e) {
    const unit = e.target.value;
    this.updateTableUnits(unit);
  }
  updateTableUnits(unit) {
    this.querySelectorAll(".size-guide--table td > button[data-cm]").forEach(
      (btn) => {
        const cmValue = btn.getAttribute("data-cm");
        if (cmValue) {
          if (unit === "cm") btn.textContent = cmValue;
          else if (unit === "in") {
            const num = parseFloat(cmValue);
            isNaN(num)
              ? (btn.textContent = cmValue)
              : (btn.textContent = Math.round(num * 0.3937007874));
          }
        }
      }
    );
  }
}
document.addEventListener("DOMContentLoaded", () => {
  customElements.define("size-drawer", SizeDrawer);
});
