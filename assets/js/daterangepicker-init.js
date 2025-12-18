(function ($) {
  if (!$ || !$.fn || typeof $.fn.daterangepicker !== 'function') {
    return;
  }

  const defaultLocale = {
    format: 'YYYY.MM.DD HH:mm A',
    separator: ' ~ ',
    applyLabel: '적용',
    cancelLabel: '취소',
    daysOfWeek: ['일', '월', '화', '수', '목', '금', '토'],
    monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
    firstDay: 0,
  };

  const applyStyledSelects = (container) => {
    container.find('select').each(function () {
      const $select = $(this);
      if (!$select.hasClass('styled-select')) {
        $select.addClass('styled-select');
      }
    });
  };

  const initializePicker = ($input, options) => {
    $input.daterangepicker(options);
    const pickerInstance = $input.data('daterangepicker');
    applyStyledSelects($(pickerInstance.container));

    $input.on('show.daterangepicker', function (ev, picker) {
      applyStyledSelects($(picker.container));
    });
  };

  const initRangePickers = () => {
    const rangePickerOptions = {
      timePicker: true,
      startDate: moment().startOf('hour'),
      endDate: moment().startOf('hour').add(32, 'hour'),
      drops: 'auto',
      locale: defaultLocale,
      isInvalidDate: function (date) {
        return date.isBetween(
          moment('2025-12-10', 'YYYY-MM-DD'),
          moment('2026-01-20', 'YYYY-MM-DD'),
          'day',
          '[]'
        );
      },
    };

    const rangeSelectors = [
      "input[data-type='datepicker'].range-picker",
      "input[data-type='datepicker']#rangePicker",
    ];

    $(rangeSelectors.join(',')).each(function () {
      initializePicker($(this), rangePickerOptions);
    });
  };

  const initSinglePickers = () => {
    const singlePickerOptions = {
      singleDatePicker: true,
      timePicker: true,
      drops: 'auto',
      autoApply: false,
      autoUpdateInput: true,
      startDate: moment().startOf('hour'),
      locale: defaultLocale,
    };

    $("input[data-type='datepicker']:not(.range-picker):not(#rangePicker)").each(function () {
      initializePicker($(this), singlePickerOptions);
    });
  };

  $(document).ready(() => {
    initRangePickers();
    initSinglePickers();
  });
})(window.jQuery);
